/** Finalização automática de conversas paradas (cron conversation-auto-close).
 * Só fecha quando a última mensagem foi NOSSA — paciente sem resposta fica aberto.
 * O Jev lê o fim da conversa: se ela terminou naturalmente (despedida, "obrigado",
 * informação entregue), fecha como concluída sem aviso; se ficou esperando o paciente,
 * avisa e fecha como inatividade. Na dúvida, fecha sem aviso. */
export const AUTO_CLOSE_HOURS = 24;
/** Passou disso, fecha sem aviso: evita disparar aviso em massa no acumulado antigo. */
export const AUTO_CLOSE_NOTIFY_MAX_HOURS = 48;
export const AUTO_CLOSE_REASON = "INATIVIDADE";
export const AUTO_CLOSE_CONCLUDED_REASON = "ATENDIMENTO_CONCLUIDO";
export const AUTO_CLOSE_NOTICE =
  "Olá! Como não tivemos retorno, estamos finalizando este atendimento. Se precisar de algo, é só mandar uma mensagem por aqui. 😊";

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

export function decideAutoClose(input: {
  now: Date;
  lastMessageAt: Date;
  lastDirection: "INBOUND" | "OUTBOUND" | null;
  pinned: boolean;
  /** 08–18h (mesma janela dos lembretes) — aviso fora disso espera a próxima rodada. */
  inWindow: boolean;
  /** Clínica com envios automáticos pausados (ex: número restrito pela Meta). */
  paused: boolean;
  ending: ConversationEnding;
}): AutoCloseDecision {
  if (input.pinned || input.lastDirection !== "OUTBOUND") return "skip";
  const hours = (input.now.getTime() - input.lastMessageAt.getTime()) / 3600_000;
  if (hours < AUTO_CLOSE_HOURS) return "skip";
  if (input.ending === "CONCLUDED") return "close_concluded";
  if (input.ending === "UNSURE" || hours >= AUTO_CLOSE_NOTIFY_MAX_HOURS || input.paused) return "close_inactive";
  return input.inWindow ? "notify_and_close" : "skip";
}
