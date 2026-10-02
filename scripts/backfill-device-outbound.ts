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
  // A Evolution só aplica o filtro de data com gte E lte juntos — só gte devolve tudo.
  const from = new Date(Date.now() - DAYS * 86400000).toISOString();
  const to = new Date().toISOString();
  const instances = await prisma.whatsappInstance.findMany({ include: { clinic: { select: { id: true, tradeName: true } } } });

  for (const inst of instances) {
    const recs: Rec[] = [];
    for (let page = 1; ; page++) {
      const res = await fetch(`${inst.apiUrl.replace(/\/$/, "")}/chat/findMessages/${encodeURIComponent(inst.instanceName)}`, {
        method: "POST",
        headers: { apikey: inst.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ where: { key: { fromMe: true }, messageTimestamp: { gte: from, lte: to } }, page, offset: 200 }),
        signal: AbortSignal.timeout(60000),
      });
      const j: any = await res.json().catch(() => null);
      recs.push(...((j?.messages?.records ?? []) as Rec[]).filter((r) => r.key?.fromMe));
      if (page >= (j?.messages?.pages ?? 0)) break;
    }

    // A paginação da Evolution repete registros (mesmo key.id em páginas diferentes).
    const seen = new Set<string>();
    for (let i = recs.length - 1; i >= 0; i--) {
      if (seen.has(recs[i].key.id)) recs.splice(i, 1);
      else seen.add(recs[i].key.id);
    }
    const stats = { total: recs.length, alreadyByKey: 0, panelTwin: 0, noTarget: 0, noConversation: 0, notText: 0, toInsert: 0 };

    // Lote: quais key.id já existem no banco.
    const existingKeys = new Set<string>();
    const ids = recs.map((r) => r.key.id);
    for (let i = 0; i < ids.length; i += 500) {
      const found = await prisma.message.findMany({ where: { whatsappKeyId: { in: ids.slice(i, i + 500) } }, select: { whatsappKeyId: true } });
      found.forEach((f) => f.whatsappKeyId && existingKeys.add(f.whatsappKeyId));
    }

    // Lote: telefone -> conversa (uma consulta por bloco de telefones, não por mensagem).
    const candidates: { r: Rec; text: string; phone: string }[] = [];
    for (const r of recs) {
      const text = textOf(r);
      if (!text) { stats.notText++; continue; }
      const phone = deviceOutboundTargetPhone(r.key);
      if (!phone) { stats.noTarget++; continue; }
      if (existingKeys.has(r.key.id)) { stats.alreadyByKey++; continue; }
      candidates.push({ r, text, phone });
    }
    const allPhones = [...new Set(candidates.flatMap((c) => variants(c.phone)))];
    const convByPhone = new Map<string, string>();
    for (let i = 0; i < allPhones.length; i += 500) {
      const contacts = await prisma.contact.findMany({
        where: { phone: { in: allPhones.slice(i, i + 500) } },
        select: { phone: true, conversations: { where: { clinicId: inst.clinicId, channel: "WHATSAPP" }, orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
      });
      for (const c of contacts) if (c.phone && c.conversations[0]) convByPhone.set(c.phone, c.conversations[0].id);
    }
    const convOf = (phone: string) => variants(phone).map((v) => convByPhone.get(v)).find(Boolean) ?? null;

    // Lote: mensagens OUTBOUND já gravadas nessas conversas na janela (pra achar a gêmea do painel).
    const convIds = [...new Set(candidates.map((c) => convOf(c.phone)).filter((x): x is string => !!x))];
    const outboundByConv = new Map<string, { id: string; content: string; whatsappKeyId: string | null; createdAt: Date }[]>();
    for (let i = 0; i < convIds.length; i += 200) {
      const rows = await prisma.message.findMany({
        where: { conversationId: { in: convIds.slice(i, i + 200) }, direction: "OUTBOUND", createdAt: { gte: new Date(from), lte: new Date(to) } },
        select: { id: true, conversationId: true, content: true, createdAt: true },
      });
      for (const m of rows) {
        const list = outboundByConv.get(m.conversationId) ?? [];
        list.push({ id: m.id, content: m.content, whatsappKeyId: null, createdAt: m.createdAt });
        outboundByConv.set(m.conversationId, list);
      }
    }

    for (const { r, text, phone } of candidates.sort((a, b) => Number(a.r.messageTimestamp) - Number(b.r.messageTimestamp))) {
      const conversationId = convOf(phone);
      if (!conversationId) { stats.noConversation++; continue; }
      const at = new Date(Number(r.messageTimestamp) * 1000);
      if (findPanelTwin(outboundByConv.get(conversationId) ?? [], { content: text, at })) { stats.panelTwin++; continue; }
      stats.toInsert++;
      if (APPLY) {
        // createMany + skipDuplicates: se o webhook gravar a mesma mensagem enquanto o
        // script roda, pula em vez de abortar tudo.
        await prisma.message.createMany({
          data: [{ conversationId, direction: "OUTBOUND", status: "SENT", content: text, whatsappKeyId: r.key.id, sentFromDevice: true, createdAt: at } as any],
          skipDuplicates: true,
        });
      }
    }
    console.log(`${inst.clinic.tradeName}:`, stats);
  }
  await prisma.$disconnect();
})();
