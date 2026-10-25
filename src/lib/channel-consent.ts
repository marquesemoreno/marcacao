import { isValidEmail, normalizeEmail, toSmsNumber } from "@/lib/broadcast-channel";

/** Consentimento de SMS e e-mail é por clínica E por canal (decisão de 25/10/2026): o aceite
 * de WhatsApp ("QUERO RECEBER") não vale aqui, porque o texto dele fala em receber "por
 * aqui". Fica em ChannelConsent, indexado pelo endereço (telefone ou e-mail). */
export type ChannelDecision = "ENVIAR" | "SAIU" | "SEM_CONSENTIMENTO";

/** Saída (revokedAt) vale se for igual ou posterior ao consentimento — na dúvida não envia.
 * Consentir de novo depois de sair volta a liberar. */
export function channelSendDecision(input: { consentAt: Date | null; revokedAt: Date | null }): ChannelDecision {
  const { consentAt, revokedAt } = input;
  if (revokedAt && (!consentAt || revokedAt.getTime() >= consentAt.getTime())) return "SAIU";
  return consentAt ? "ENVIAR" : "SEM_CONSENTIMENTO";
}

/** Forma canônica do endereço usada na chave do consentimento; null se for inválido. */
export function consentAddress(channel: "SMS" | "EMAIL", raw: string): string | null {
  if (channel === "EMAIL") return isValidEmail(raw) ? normalizeEmail(raw) : null;
  return toSmsNumber(raw);
}

export const NO_CHANNEL_CONSENT_MESSAGE = "Sem consentimento para este canal";
export const CHANNEL_OPT_OUT_MESSAGE = "Pediu para não receber";
