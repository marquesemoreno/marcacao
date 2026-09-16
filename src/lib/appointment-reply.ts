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

/** Frases fixas presentes nos templates que pedem confirmação de agendamento (lembrete
 * D-1, confirmação do marketplace, confirmação do bridge) — ver bridge-reminder.ts,
 * bridge-confirmation.ts e sendAppointmentConfirmation em whatsapp.ts. A versão "Lara"
 * do lembrete (só Urolaser) não tem menu numerado, por isso tem seu próprio marcador
 * (ver LARA_CONFIRMATION_MARKER em bridge-reminder.ts) somado à lista aqui. */
const CONFIRMATION_PROMPT_MARKERS = [
  "Digite 1 para Confirmar presença",
  "responda esta mensagem para confirmar sua presença", // formato antigo da Lara — mantido pra reconhecer lembretes já enviados antes da mudança pro formato SIM/NÃO (15/09/2026)
  "responda SIM para confirmar sua presença", // formato SIM/NÃO sem negrito — mantido pra reconhecer lembretes enviados antes do SIM/NÃO virar negrito (15/09/2026)
  "responda *SIM* para confirmar sua presença",
];

/** Bug real (relatado por atendente, com print do WhatsApp): paciente respondia "Sim"
 * pra uma pergunta qualquer da atendente no meio de uma conversa manual (ex: "seria
 * biópsia de próstata, correto?") e o sistema entendia como confirmação de agendamento,
 * disparando por cima a mensagem automática de confirmação — sem nenhuma relação com o
 * que estava sendo conversado. resolveStatusFromReply/isRescheduleReply só devem valer
 * quando a ÚLTIMA mensagem NOSSA nessa conversa foi de fato um pedido de confirmação. */
export function wasSentConfirmationPrompt(lastOutboundContent: string | null | undefined): boolean {
  if (!lastOutboundContent) return false;
  return CONFIRMATION_PROMPT_MARKERS.some((marker) => lastOutboundContent.includes(marker));
}
