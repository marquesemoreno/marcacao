import type { AppointmentStatus } from "@prisma/client";

/** Normaliza pra comparação tolerante a acento/caixa/pontuação final — mesma técnica
 * já usada em parseConsentReply (ai-attendant.ts). Só remove pontuação NO FINAL da
 * mensagem (ex: "confirmado!"), não no meio — não é pra transformar frases longas
 * em falso positivo. */
function normalizeReply(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!.,;]+$/, "")
    .trim();
}

// Comparação sempre pela mensagem INTEIRA normalizada, nunca por substring — uma
// frase mais longa que só contém a palavra "não" no meio (ex: dúvida do paciente)
// não pode disparar cancelamento sozinha.
const CONFIRM_REPLIES = ["1", "sim", "sim, confirmo", "s", "confirmo", "confirmado", "confirmada", "confirmar", "ok", "okay"];
const CANCEL_REPLIES = ["3", "cancelar", "não", "nao", "cancelado", "cancelada", "cancelo"];
const RESCHEDULE_REPLIES = ["2", "remarcar", "reagendar"];

/** Bug real: pacientes respondiam a mensagem de confirmação com "Confirmado",
 * "Confirmo" etc. em vez do "1" pedido no texto, e a confirmação era ignorada
 * (só reconhecia o número exato ou "sim"). Ampliado pra cobrir as variações mais
 * comuns, mantendo o cuidado de só casar a mensagem inteira normalizada. */
export function resolveStatusFromReply(text: string): AppointmentStatus | null {
  const normalized = normalizeReply(text);
  if (CONFIRM_REPLIES.includes(normalized)) return "CONFIRMED";
  if (CANCEL_REPLIES.includes(normalized)) return "CANCELLED";
  return null;
}

/** "Remarcar" não é um AppointmentStatus (não temos automação de reagendar
 * sozinho) — só sinaliza que um atendente precisa assumir e remarcar na mão.
 * Checado só quando resolveStatusFromReply não bateu, senão "2" nunca chegaria
 * aqui de propósito (não colide hoje, mas mantém a prioridade clara). */
export function isRescheduleReply(text: string): boolean {
  return RESCHEDULE_REPLIES.includes(normalizeReply(text));
}
