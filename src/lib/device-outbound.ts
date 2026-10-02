/** Mensagens enviadas pela clínica FORA do painel (WhatsApp do celular / WhatsApp Web) —
 * chegam no webhook como messages.upsert com key.fromMe = true. Parte pura (sem banco)
 * do tratamento em src/app/api/webhooks/whatsapp/route.ts. */

type MessageKeyLike = { remoteJid?: unknown; remoteJidAlt?: unknown; senderPn?: unknown };

const jidDigits = (jid: string) => jid.replace(/@.*/, "").replace(/\D/g, "");

/** Telefone do PACIENTE (destino) — em fromMe o remoteJid é o outro lado da conversa.
 * Grupo/status/broadcast não são conversa de paciente. @lid é um id interno do
 * WhatsApp, não telefone: só dá pra usar se a Evolution mandar o alternativo. */
export function deviceOutboundTargetPhone(key: MessageKeyLike): string | null {
  const remoteJid = typeof key.remoteJid === "string" ? key.remoteJid : "";
  if (!remoteJid || remoteJid.endsWith("@g.us") || remoteJid.endsWith("@broadcast") || remoteJid.endsWith("@newsletter")) {
    return null;
  }
  let jid = remoteJid;
  if (remoteJid.endsWith("@lid")) {
    const alt = [key.remoteJidAlt, key.senderPn].find((v): v is string => typeof v === "string" && !v.endsWith("@lid"));
    if (!alt) return null;
    jid = alt;
  }
  const digits = jidDigits(jid);
  return digits.length >= 10 ? digits : null;
}

const TWIN_WINDOW_MS = 2 * 60 * 1000;

/** Mensagem que o próprio painel (ou uma automação nossa) já gravou e que está voltando
 * agora como fromMe — o painel só grava o whatsappKeyId DEPOIS que a Evolution responde,
 * então o webhook pode chegar antes. Mesmo texto, ainda sem keyId, até 2 min antes. */
export function findPanelTwin<T extends { id: string; content: string; whatsappKeyId: string | null; createdAt: Date }>(
  candidates: T[],
  incoming: { content: string; at: Date }
): T | null {
  const text = incoming.content.trim();
  let best: T | null = null;
  for (const c of candidates) {
    if (c.whatsappKeyId || c.content.trim() !== text) continue;
    const delta = Math.abs(incoming.at.getTime() - c.createdAt.getTime());
    if (delta > TWIN_WINDOW_MS) continue;
    if (!best || delta < Math.abs(incoming.at.getTime() - best.createdAt.getTime())) best = c;
  }
  return best;
}
