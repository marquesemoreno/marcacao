/**
 * Recupera mensagens perdidas no incidente de 2026-09-27 (banco restaurado do backup,
 * última mensagem 2026-09-25T22:22:15Z) a partir do histórico guardado na Evolution API.
 *
 *   npx tsx --env-file=.env scripts/recover-evolution-messages.ts          (simulação)
 *   npx tsx --env-file=.env scripts/recover-evolution-messages.ts --apply  (grava)
 *
 * Reimplementa o mínimo do webhook inline porque whatsapp-media.ts / supabase-server.ts
 * são "server-only" e não rodam fora do Next. Idempotente: pula whatsappKeyId que já existe.
 */
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");
const FROM = "2026-09-25T22:22:15Z";
const TO = "2026-09-27T05:00:00Z";
const BUCKET = "whatsapp-media";

const prisma = new PrismaClient();
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

type Rec = {
  key: { id: string; remoteJid: string; fromMe: boolean; remoteJidAlt?: string; senderPn?: string };
  pushName?: string;
  messageType: string;
  message: Record<string, any>;
  messageTimestamp: number;
};

function phoneFromRec(r: Rec): string | null {
  let jid = r.key.remoteJid;
  if (jid.endsWith("@g.us") || jid === "status@broadcast") return null;
  if (jid.endsWith("@lid")) jid = r.key.remoteJidAlt ?? r.key.senderPn ?? "";
  const digits = jid.replace(/@.*/, "").replace(/\D/g, "");
  return digits.length >= 12 ? digits : null;
}

/** Mesmo formato 13↔12 dígitos do fallback de 9º dígito (ver toggleNinthDigit em whatsapp.ts). */
function phoneVariants(p: string): string[] {
  if (p.length === 13 && p.startsWith("55") && p[4] === "9") return [p, p.slice(0, 4) + p.slice(5)];
  if (p.length === 12 && p.startsWith("55")) return [p, p.slice(0, 4) + "9" + p.slice(4)];
  return [p];
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s) % 60).padStart(2, "0")}`;
const extOf = (mime: string) =>
  ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf", "audio/ogg": "ogg", "audio/mpeg": "mp3", "video/mp4": "mp4" } as Record<string, string>)[mime.split(";")[0].trim()] ?? "bin";

type Parsed =
  | { kind: "text"; text: string }
  | { kind: "media"; text: string; mime: string; fileName: string; audioSeconds?: number; msgKey: string }
  | { kind: "reaction"; emoji: string; targetKeyId: string };

function parse(r: Rec): Parsed | null {
  const m = r.message ?? {};
  const text = m.conversation ?? m.extendedTextMessage?.text;
  if (typeof text === "string") return { kind: "text", text };
  if (m.reactionMessage) return { kind: "reaction", emoji: m.reactionMessage.text ?? "", targetKeyId: m.reactionMessage.key?.id };
  const media =
    (m.imageMessage && ["imageMessage", "📷 Imagem", "imagem.jpg", "a"]) ||
    (m.videoMessage && ["videoMessage", "🎬 Vídeo", "video.mp4", "o"]) ||
    (m.documentMessage && ["documentMessage", "📄 Documento", "documento", "o"]) ||
    (m.audioMessage && ["audioMessage", "🎤 Áudio", "audio.ogg", "o"]);
  if (media) {
    const [k, label, defName, g] = media as [string, string, string, string];
    const part = m[k];
    return {
      kind: "media",
      text: part.caption || `${label} ${r.key.fromMe ? "enviad" : "recebid"}${g}`,
      mime: part.mimetype ?? "application/octet-stream",
      fileName: part.fileName ?? defName,
      audioSeconds: k === "audioMessage" ? Number(part.seconds ?? 0) : undefined,
      msgKey: k,
    };
  }
  return null;
}

async function evo(inst: { apiUrl: string; apiKey: string; instanceName: string }, path: string, body: unknown) {
  const res = await fetch(`${inst.apiUrl.replace(/\/$/, "")}/${path}/${encodeURIComponent(inst.instanceName)}`, {
    method: "POST",
    headers: { apikey: inst.apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  return res.json() as Promise<any>;
}

(async () => {
  console.log(APPLY ? "=== GRAVANDO ===" : "=== SIMULAÇÃO (use --apply pra gravar) ===");
  const instances = await prisma.whatsappInstance.findMany({ include: { clinic: { select: { id: true, tradeName: true } } } });

  for (const inst of instances) {
    const recs: Rec[] = [];
    for (let page = 1; ; page++) {
      const j = await evo(inst, "chat/findMessages", { where: { messageTimestamp: { gte: FROM, lte: TO } }, page, offset: 100 });
      recs.push(...(j?.messages?.records ?? []));
      if (page >= (j?.messages?.pages ?? 0)) break;
    }
    if (recs.length === 0) continue;
    recs.sort((a, b) => Number(a.messageTimestamp) - Number(b.messageTimestamp));
    console.log(`\n## ${inst.clinic.tradeName} — ${recs.length} mensagem(ns)`);

    const lastByConv = new Map<string, Date>();
    for (const r of recs) {
      const at = new Date(Number(r.messageTimestamp) * 1000);
      const tag = `${at.toISOString().slice(5, 16)} ${r.key.fromMe ? "→" : "←"}`;
      const phone = phoneFromRec(r);
      const parsed = parse(r);
      if (!phone || !parsed) {
        console.log(`  ${tag} PULADA (${!phone ? `jid ${r.key.remoteJid}` : `tipo ${r.messageType}`})`);
        continue;
      }
      if (await prisma.message.findUnique({ where: { whatsappKeyId: r.key.id }, select: { id: true } })) {
        console.log(`  ${tag} ${phone} já existe`);
        continue;
      }

      if (parsed.kind === "reaction") {
        const target = await prisma.message.findUnique({ where: { whatsappKeyId: parsed.targetKeyId }, select: { id: true } });
        console.log(`  ${tag} ${phone} reação ${parsed.emoji || "(removida)"} ${target ? "" : "— mensagem alvo não existe, pulada"}`);
        if (APPLY && target) {
          await prisma.message.update({
            where: { id: target.id },
            data: r.key.fromMe ? { agentReaction: parsed.emoji || null } : { contactReaction: parsed.emoji || null },
          });
        }
        continue;
      }

      const contact = await prisma.contact.findFirst({ where: { phone: { in: phoneVariants(phone) } } });
      const conversation = contact
        ? await prisma.conversation.findFirst({ where: { contactId: contact.id, clinicId: inst.clinicId }, orderBy: { createdAt: "desc" } })
        : null;
      const preview = parsed.text.replace(/\s+/g, " ").slice(0, 60);
      console.log(
        `  ${tag} ${phone} ${contact ? "" : "[contato novo] "}${conversation ? "" : "[conversa nova] "}${parsed.kind === "media" ? `[${parsed.msgKey}] ` : ""}${preview}`
      );
      if (!APPLY) continue;

      const c =
        contact ??
        (await prisma.contact.create({ data: { phone, name: (!r.key.fromMe && r.pushName) || phone } }));
      const conv =
        conversation ??
        (await prisma.conversation.create({ data: { clinicId: inst.clinicId, contactId: c.id, status: "OPEN", lastMessageAt: at } }));

      let media: Record<string, string> = {};
      let content = parsed.text;
      if (parsed.kind === "media") {
        const b = await evo(inst, "chat/getBase64FromMediaMessage", { message: { key: r.key }, convertToMp4: false }).catch(() => null);
        if (b?.base64) {
          const buf = Buffer.from(b.base64, "base64");
          const path = `${conv.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extOf(parsed.mime)}`;
          const { error } = await supabase.storage.from(BUCKET).upload(path, buf, { contentType: parsed.mime.split(";")[0].trim() });
          if (!error) {
            media =
              parsed.audioSeconds !== undefined
                ? { type: "AUDIO", mediaPath: path, mimeType: parsed.mime, audioDuration: formatDuration(parsed.audioSeconds) }
                : { type: "ATTACHMENT", mediaPath: path, mimeType: parsed.mime, attachmentName: parsed.fileName, attachmentSize: formatSize(buf.byteLength) };
          }
        }
        if (!media.mediaPath) {
          content = `⚠️ Não foi possível recuperar a mídia (${parsed.fileName}) — mensagem recuperada do histórico.`;
          console.log("    ! mídia não recuperada");
        }
      }

      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: r.key.fromMe ? "OUTBOUND" : "INBOUND",
          content,
          status: r.key.fromMe ? "SENT" : "DELIVERED",
          whatsappKeyId: r.key.id,
          createdAt: at,
          ...media,
        } as any,
      });
      const prev = lastByConv.get(conv.id);
      if (!prev || at > prev) lastByConv.set(conv.id, at);
    }

    for (const [id, at] of lastByConv) {
      const conv = await prisma.conversation.findUnique({ where: { id }, select: { lastMessageAt: true } });
      if (!conv?.lastMessageAt || conv.lastMessageAt < at) {
        await prisma.conversation.update({ where: { id }, data: { lastMessageAt: at, archivedAt: null } });
      }
    }
  }
  await prisma.$disconnect();
})();
