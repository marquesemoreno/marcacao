/** Finalização automática de conversas paradas (cron conversation-auto-close).
 * Só fecha quando a última mensagem foi NOSSA — paciente sem resposta fica aberto.
 * O Jev lê o fim da conversa: se ela terminou naturalmente (despedida, "obrigado",
 * informação entregue), fecha como concluída sem aviso; se ficou esperando o paciente,
 * avisa e fecha como inatividade. Na dúvida, fecha sem aviso. */
/** Em HORAS ÚTEIS (08–18h, seg–sáb). Medido em 09/10/2026 (5.970 respostas, Urolaser +
 * Santa Clara, 60 dias): metade dos pacientes responde em ~2 min; depois de 4h úteis só
 * 9% ainda respondem e a curva quase para de cair (8h: 7%, 20h: 4%). Quem responde
 * depois reabre a conversa com a mesma atendente (reopenIfResolved). */
export const AUTO_CLOSE_HOURS = 4;
/** Passou disso (~2 dias úteis), fecha sem aviso: evita aviso em massa no acumulado. */
export const AUTO_CLOSE_NOTIFY_MAX_HOURS = 20;
export const AUTO_CLOSE_REASON = "INATIVIDADE";
export const AUTO_CLOSE_CONCLUDED_REASON = "ATENDIMENTO_CONCLUIDO";
export const AUTO_CLOSE_NOTICE =
  "Vamos finalizar este atendimento por aqui. Se precisar de algo, é só mandar uma mensagem que retomamos. 😊";

/** Testado com conversas reais (08/10/2026): fins claros ("obrigada" / "Disponha!") vêm
 * ~0,8; ambíguos ~0,2–0,4. Abaixo disso = dúvida → fecha sem aviso. */
export const AUTO_CLOSE_MIN_CONFIDENCE = 0.75;

export type ConversationEnding = "CONCLUDED" | "AWAITING" | "UNSURE";
export type AutoCloseDecision = "skip" | "notify_and_close" | "close_inactive" | "close_concluded";

export const CONVERSATION_ENDING_QUESTION = {
  type: "choice",
  instructions:
    "Conversa de WhatsApp entre a recepção de uma clínica médica e um paciente (`mensagens`, da mais antiga para a mais recente; `de` diz quem escreveu). A última mensagem é da clínica e o paciente não escreve há mais de um dia. A conversa terminou ou a clínica ficou esperando uma resposta do paciente?",
  criteria: {
    CONCLUDED:
      "A conversa terminou naturalmente: despedida, agradecimento, \"ok\"/👍, confirmação feita, informação entregue sem nenhuma pergunta ou pendência para o paciente responder.",
    AWAITING:
      "A clínica fez uma pergunta, pediu um dado/documento ou enviou orçamento/opções e o paciente não respondeu — ficou esperando o paciente.",
  },
};

export function endingFromJevAnswer(
  answer: { type: string; choice?: string; confidence?: number } | undefined
): ConversationEnding {
  if (!answer || answer.type !== "choice") return "UNSURE";
  if (answer.choice !== "CONCLUDED" && answer.choice !== "AWAITING") return "UNSURE";
  if ((answer.confidence ?? 0) < AUTO_CLOSE_MIN_CONFIDENCE) return "UNSURE";
  return answer.choice;
}

const BUSINESS_START = 8;
const BUSINESS_END = 18;
const BAHIA_OFFSET_MS = 3 * 3600_000; // UTC-3 fixo, sem horário de verão

/** Horas úteis (08–18h, segunda a sábado, horário da Bahia) entre `from` e `to`. */
export function businessHoursBetween(from: Date, to: Date): number {
  if (to <= from) return 0;
  const start = from.getTime() - BAHIA_OFFSET_MS;
  const end = to.getTime() - BAHIA_OFFSET_MS;
  let total = 0;
  // Um passo por dia (horário local representado em UTC); limitado a 120 dias.
  let day = Math.floor(start / 86_400_000) * 86_400_000;
  for (let i = 0; day < end && i < 120; i++, day += 86_400_000) {
    if (new Date(day).getUTCDay() === 0) continue;
    const open = Math.max(start, day + BUSINESS_START * 3600_000);
    const close = Math.min(end, day + BUSINESS_END * 3600_000);
    if (close > open) total += close - open;
  }
  return total / 3600_000;
}

export function decideAutoClose(input: {
  /** Horas úteis desde a última mensagem (businessHoursBetween). */
  idleBusinessHours: number;
  lastDirection: "INBOUND" | "OUTBOUND" | null;
  pinned: boolean;
  /** 08–18h (mesma janela dos lembretes) — aviso fora disso espera a próxima rodada. */
  inWindow: boolean;
  /** Clínica com envios automáticos pausados (ex: número restrito pela Meta). */
  paused: boolean;
  ending: ConversationEnding;
}): AutoCloseDecision {
  if (input.pinned || input.lastDirection !== "OUTBOUND") return "skip";
  const hours = input.idleBusinessHours;
  if (hours < AUTO_CLOSE_HOURS) return "skip";
  if (input.ending === "CONCLUDED") return "close_concluded";
  if (input.ending === "UNSURE" || hours >= AUTO_CLOSE_NOTIFY_MAX_HOURS || input.paused) return "close_inactive";
  return input.inWindow ? "notify_and_close" : "skip";
}
