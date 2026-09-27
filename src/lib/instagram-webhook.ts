/** Parte pura da integração com Instagram Direct (Instagram API com Instagram Login) —
 * assinatura do webhook, normalização do payload e janela de mensagens da Meta.
 * Sem banco/rede aqui, pra dar pra testar; o resto fica em src/lib/instagram.ts e na
 * rota src/app/api/webhooks/instagram/route.ts. */
import { createHmac, timingSafeEqual } from "node:crypto";

/** X-Hub-Signature-256 = "sha256=" + HMAC-SHA256(corpo cru, App Secret). Sem segredo
 * configurado, recusa tudo — nunca aceitar webhook sem verificar. */
export function verifyMetaSignature(rawBody: string, header: string | null, appSecret: string | undefined): boolean {
  if (!appSecret || !header?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody).digest();
  const received = Buffer.from(header.slice(7), "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export type InstagramAttachment = { type: string; url: string | null };

export type InstagramEvent =
  | {
      kind: "message";
      /** Conta de Instagram da clínica (entry.id) — acha a clínica. */
      accountId: string;
      /** IGSID do lead (o "outro lado", mesmo em echo). */
      userId: string;
      /** Echo: resposta enviada pela equipe direto pelo app do Instagram (ou por nós). */
      fromMe: boolean;
      mid: string;
      text: string | null;
      attachments: InstagramAttachment[];
      timestamp: Date;
    }
  | { kind: "read"; accountId: string; userId: string; mid: string }
  | { kind: "deleted"; accountId: string; mid: string };

type RawMessaging = {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: {
    mid?: string;
    text?: string;
    is_echo?: boolean;
    is_deleted?: boolean;
    attachments?: { type?: string; payload?: { url?: string } }[];
  };
  read?: { mid?: string };
};

export function parseInstagramWebhook(body: unknown): InstagramEvent[] {
  const b = body as { object?: string; entry?: { id?: string; messaging?: RawMessaging[] }[] } | null;
  if (!b || b.object !== "instagram" || !Array.isArray(b.entry)) return [];

  const events: InstagramEvent[] = [];
  for (const entry of b.entry) {
    const accountId = entry.id;
    if (!accountId) continue;
    for (const m of entry.messaging ?? []) {
      const senderId = m.sender?.id;
      const recipientId = m.recipient?.id;
      if (!senderId || !recipientId) continue;
      const fromMe = Boolean(m.message?.is_echo) || senderId === accountId;
      const userId = fromMe ? recipientId : senderId;

      if (m.read?.mid) {
        events.push({ kind: "read", accountId, userId, mid: m.read.mid });
        continue;
      }
      const msg = m.message;
      if (!msg?.mid) continue;
      if (msg.is_deleted) {
        events.push({ kind: "deleted", accountId, mid: msg.mid });
        continue;
      }
      events.push({
        kind: "message",
        accountId,
        userId,
        fromMe,
        mid: msg.mid,
        text: typeof msg.text === "string" ? msg.text : null,
        attachments: (msg.attachments ?? []).map((a) => ({ type: a.type ?? "file", url: a.payload?.url ?? null })),
        timestamp: new Date(m.timestamp ?? Date.now()),
      });
    }
  }
  return events;
}

export { messagingWindowState } from "./messaging-window";
