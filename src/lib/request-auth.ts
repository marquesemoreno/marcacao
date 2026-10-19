import { timingSafeEqual } from "node:crypto";

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Header `Authorization` dos crons da Vercel (`Bearer ${CRON_SECRET}`). Sem CRON_SECRET
 * configurado recusa tudo — a comparação direta com a template string aceitava o literal
 * "Bearer undefined". */
export function isCronAuthorized(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return !!authHeader && safeEqual(authHeader, `Bearer ${secret}`);
}

/** Token do webhook da Evolution API (header `x-webhook-token`). Segredo opcional de
 * propósito: ele tem que ser configurado na Vercel e na Evolution ao mesmo tempo, então
 * sem ele o webhook segue aberto (como antes) em vez de derrubar o recebimento. */
export function isWebhookTokenAuthorized(provided: string | null, required: string | undefined): boolean {
  if (!required) return true;
  return !!provided && safeEqual(provided, required);
}
