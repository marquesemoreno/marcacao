/* eslint-disable @typescript-eslint/no-explicit-any -- payload da Evolution sem tipagem, script avulso */
/**
 * C1 — reprocessa respostas da clínica enviadas pelo celular/WhatsApp Web (fromMe) que o
 * webhook descartava antes do fix. Fonte: histórico da Evolution (chat/findMessages).
 *
 *   npx tsx --env-file=.env scripts/backfill-device-outbound.ts --days=30            (só conta)
 *   npx tsx --env-file=.env scripts/backfill-device-outbound.ts --days=30 --apply    (grava)
 *
 * Só grava em conversa que JÁ existe (não cria contato/conversa), só texto (mídia vira
 * marcador), pula o que já está no banco por key.id e o que o painel/automação já gravou
 * sem keyId (mesmo texto, OUTBOUND, ±2 min). --apply exige a coluna sent_from_device
 * (migração 20261002120000) aplicada.
 */
import { PrismaClient } from "@prisma/client";
import { deviceOutboundTargetPhone, findPanelTwin } from "../src/lib/device-outbound";

const APPLY = process.argv.includes("--apply");
const DAYS = Number(process.argv.find((a) => a.startsWith("--days="))?.slice(7) ?? 30);
const prisma = new PrismaClient();

type Rec = {
  key: { id: string; remoteJid: string; fromMe: boolean; remoteJidAlt?: string; senderPn?: string };
  message?: Record<string, any>;
  messageTimestamp: number;
};

function textOf(r: Rec): string | null {
  const m = r.message ?? {};
  if (typeof m.conversation === "string") return m.conversation;
  if (typeof m.extendedTextMessage?.text === "string") return m.extendedTextMessage.text;
  if (m.imageMessage) return m.imageMessage.caption || "📷 Imagem enviada pelo celular";
  if (m.documentMessage) return m.documentMessage.caption || `📄 ${m.documentMessage.fileName ?? "Documento"} enviado pelo celular`;
  if (m.audioMessage) return "🎤 Áudio enviado pelo celular";
  if (m.videoMessage) return m.videoMessage.caption || "🎬 Vídeo enviado pelo celular";
  return null; // reação, figurinha, protocolo… não viram mensagem
}

const variants = (p: string) =>
  p.length === 13 && p[4] === "9" ? [p, p.slice(0, 4) + p.slice(5)] : p.length === 12 ? [p, p.slice(0, 4) + "9" + p.slice(4)] : [p];

(async () => {
  console.log(APPLY ? "=== GRAVANDO ===" : `=== SÓ CONTAGEM (últimos ${DAYS} dias) ===`);
  const from = new Date(Date.now() - DAYS * 86400000).toISOString();
  const instances = await prisma.whatsappInstance.findMany({ include: { clinic: { select: { id: true, tradeName: true } } } });

  for (const inst of instances) {
    const recs: Rec[] = [];
    for (let page = 1; ; page++) {
      const res = await fetch(`${inst.apiUrl.replace(/\/$/, "")}/chat/findMessages/${encodeURIComponent(inst.instanceName)}`, {
        method: "POST",
        headers: { apikey: inst.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { fromMe: true }, messageTimestamp: { gte: from } }, page, offset: 200 }),
        signal: AbortSignal.timeout(60000),
      });
      const j: any = await res.json().catch(() => null);
      recs.push(...((j?.messages?.records ?? []) as Rec[]).filter((r) => r.key?.fromMe));
      if (page >= (j?.messages?.pages ?? 0)) break;
    }

    const stats = { total: recs.length, alreadyByKey: 0, panelTwin: 0, noTarget: 0, noConversation: 0, notText: 0, toInsert: 0 };
    const convCache = new Map<string, string | null>();
    for (const r of recs.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp))) {
      const text = textOf(r);
      if (!text) { stats.notText++; continue; }
      const phone = deviceOutboundTargetPhone(r.key);
      if (!phone) { stats.noTarget++; continue; }
      if (await prisma.message.findUnique({ where: { whatsappKeyId: r.key.id }, select: { id: true } })) { stats.alreadyByKey++; continue; }

      if (!convCache.has(phone)) {
        const contact = await prisma.contact.findFirst({ where: { phone: { in: variants(phone) } }, select: { id: true } });
        const conv = contact
          ? await prisma.conversation.findFirst({ where: { contactId: contact.id, clinicId: inst.clinicId, channel: "WHATSAPP" }, orderBy: { createdAt: "desc" }, select: { id: true } })
          : null;
        convCache.set(phone, conv?.id ?? null);
      }
      const conversationId = convCache.get(phone);
      if (!conversationId) { stats.noConversation++; continue; }

      const at = new Date(Number(r.messageTimestamp) * 1000);
      const near = await prisma.message.findMany({
        where: { conversationId, direction: "OUTBOUND", createdAt: { gte: new Date(at.getTime() - 120000), lte: new Date(at.getTime() + 120000) } },
        select: { id: true, content: true, whatsappKeyId: true, createdAt: true },
      });
      if (findPanelTwin(near.map((n) => ({ ...n, whatsappKeyId: null })), { content: text, at })) { stats.panelTwin++; continue; }

      stats.toInsert++;
      if (APPLY) {
        await prisma.message.create({
          data: { conversationId, direction: "OUTBOUND", status: "SENT", content: text, whatsappKeyId: r.key.id, sentFromDevice: true, createdAt: at } as any,
        });
      }
    }
    console.log(`${inst.clinic.tradeName}:`, stats);
  }
  await prisma.$disconnect();
})();
