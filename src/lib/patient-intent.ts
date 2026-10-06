/** Intenção do paciente na fila do Chat (crítica de design #2, out/2026): o Jev classifica
 * as últimas mensagens do paciente e a linha da fila mostra "Quer remarcar" em vez da
 * mensagem crua — só com confiança alta. Gravado em Conversation.patientIntent*. */

export const PATIENT_INTENTS = {
  AGENDAR: "Quer agendar",
  REMARCAR: "Quer remarcar",
  CANCELAR: "Quer cancelar",
  CONFIRMAR: "Confirma presença",
  PRECO: "Preço ou convênio",
  RESULTADO: "Resultado de exame",
  DUVIDA: "Outra dúvida",
  SAUDACAO: "Só cumprimento",
} as const;

export type PatientIntent = keyof typeof PATIENT_INTENTS;

/** Abaixo disso a fila mostra a mensagem crua. */
export const PATIENT_INTENT_MIN_CONFIDENCE = 0.85;

/** Categorias que não ajudam a triagem — nunca viram selo. */
const HIDDEN: PatientIntent[] = ["SAUDACAO", "DUVIDA"];

export function intentFromJevAnswer(
  answer: { type: string; choice?: string; confidence?: number } | undefined
): { intent: PatientIntent; confidence: number } | null {
  if (!answer || answer.type !== "choice" || !answer.choice || !(answer.choice in PATIENT_INTENTS)) return null;
  return { intent: answer.choice as PatientIntent, confidence: answer.confidence ?? 0 };
}

export function visibleIntent(intent: string | null | undefined, confidence: number | null | undefined): PatientIntent | null {
  if (!intent || !(intent in PATIENT_INTENTS)) return null;
  if ((confidence ?? 0) < PATIENT_INTENT_MIN_CONFIDENCE) return null;
  if (HIDDEN.includes(intent as PatientIntent)) return null;
  return intent as PatientIntent;
}

export const PATIENT_INTENT_QUESTION = {
  type: "choice",
  instructions:
    "Um paciente escreveu para a recepção de uma clínica médica pelo WhatsApp (`mensagens`, da mais antiga para a mais recente). O que ele quer agora, considerando principalmente a mensagem mais recente?",
  criteria: {
    AGENDAR: "Quer marcar uma consulta, exame ou procedimento novo.",
    REMARCAR: "Quer mudar a data ou o horário de algo já marcado.",
    CANCELAR: "Quer cancelar ou avisa que não vai comparecer, sem pedir outra data.",
    CONFIRMAR: "Confirma que vai comparecer ao que está marcado.",
    PRECO: "Pergunta valor, forma de pagamento ou se atende convênio.",
    RESULTADO: "Pergunta por resultado, laudo ou entrega de exame.",
    DUVIDA: "Outra pergunta ou pedido (endereço, preparo, documento, horário de funcionamento...).",
    SAUDACAO: "Só cumprimenta, agradece ou responde sem pedir nada.",
  },
};
