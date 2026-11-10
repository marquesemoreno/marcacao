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

export type WebhookTokenVerdict = "open" | "valid" | "unverified" | "rejected";

/** Decisão do webhook da Evolution em duas etapas, pra ligar o segredo sem perder mensagem:
 * 1. preparo — WHATSAPP_WEBHOOK_SECRET existe, mas a trava está desligada: quem vier sem o
 *    token certo ainda é aceito ("unverified") e a rota avisa qual instância falta ajustar;
 * 2. trava — WHATSAPP_WEBHOOK_ENFORCE ligado: sem o token certo é recusado ("rejected").
 * Sem segredo o webhook segue aberto ("open"), como sempre foi. */
export function webhookTokenVerdict(
  provided: string | null,
  secret: string | undefined,
  enforce: boolean
): WebhookTokenVerdict {
  if (!secret) return "open";
  if (provided && safeEqual(provided, secret)) return "valid";
  return enforce ? "rejected" : "unverified";
}

/** Valor de WHATSAPP_WEBHOOK_ENFORCE que liga a trava ("1" ou "true"). */
export function isWebhookEnforced(value: string | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

/** Segredo do encaminhamento interno (header `x-internal-secret`, hoje o CRON_SECRET) —
 * usado pela API oficial ao repassar a mensagem pro webhook da Evolution com a clínica no
 * cabeçalho. Sem segredo configurado recusa tudo; comparação em tempo constante. */
export function isInternalSecretAuthorized(provided: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  return !!provided && safeEqual(provided, secret);
}
