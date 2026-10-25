import { createHmac, timingSafeEqual } from "node:crypto";

/** Token do link "não quero mais receber" de SMS e e-mail: `<id do ChannelConsent>.<assinatura>`.
 * Curto de propósito (cabe numa mensagem de SMS) — a assinatura (16 caracteres de HMAC-SHA256)
 * impede que alguém descadastre outros adivinhando ids. Sem prazo de validade: o link do
 * e-mail precisa continuar funcionando meses depois. */
const SIGNATURE_LENGTH = 16;

function signature(consentId: string, secret: string): string {
  return createHmac("sha256", secret).update(consentId).digest("base64url").slice(0, SIGNATURE_LENGTH);
}

export function signUnsubscribeToken(consentId: string, secret: string): string {
  if (!secret) throw new Error("UNSUBSCRIBE_SECRET não configurado");
  return `${consentId}.${signature(consentId, secret)}`;
}

/** Devolve o id do consentimento se a assinatura confere, senão null (nunca lança). */
export function verifyUnsubscribeToken(token: string, secret: string): string | null {
  if (!secret) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [consentId, given] = parts;
  if (!consentId || !given) return null;
  const expected = Buffer.from(signature(consentId, secret));
  const actual = Buffer.from(given);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  return consentId;
}
