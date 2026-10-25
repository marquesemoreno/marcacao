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

/** Texto colado pela gestão (um endereço por linha, ou separados por vírgula/ponto e vírgula)
 * → endereços canônicos sem repetição + o que não deu pra entender (a tela mostra). */
export function parseConsentList(channel: "SMS" | "EMAIL", raw: string): { addresses: string[]; invalid: string[] } {
  const seen = new Set<string>();
  const addresses: string[] = [];
  const invalid: string[] = [];
  for (const token of raw.split(/[\n,;]+/).map((t) => t.trim()).filter(Boolean)) {
    const address = consentAddress(channel, token);
    if (!address) invalid.push(token);
    else if (!seen.has(address)) {
      seen.add(address);
      addresses.push(address);
    }
  }
  return { addresses, invalid };
}

/** O que gravar ao registrar uma lista de aceites: endereço novo cria; quem tinha saído e
 * aceita de novo renova (consentAt passa a ser depois da saída); quem já está ativo não é
 * tocado — preserva a data do aceite original, que é a prova. */
export function planConsentChanges(
  existing: Map<string, { consentAt: Date; revokedAt: Date | null }>,
  addresses: string[]
): { create: string[]; renew: string[]; already: number } {
  const create: string[] = [];
  const renew: string[] = [];
  let already = 0;
  for (const address of addresses) {
    const current = existing.get(address);
    if (!current) create.push(address);
    else if (current.revokedAt && current.revokedAt.getTime() >= current.consentAt.getTime()) renew.push(address);
    else already++;
  }
  return { create, renew, already };
}
