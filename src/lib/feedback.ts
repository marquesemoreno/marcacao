/** Função pura (sem prisma/env) — monta o texto mandado por WhatsApp quando uma
 * atendente reporta bug/sugestão pelo widget flutuante (ver src/actions/feedback.ts). */

export type FeedbackType = "BUG" | "SUGGESTION";

const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  BUG: "🐛 *Bug reportado*",
  SUGGESTION: "💡 *Sugestão*",
};

export function buildFeedbackMessage(input: {
  type: FeedbackType;
  description: string;
  clinicName: string;
  userName: string;
}): string {
  return `${FEEDBACK_TYPE_LABEL[input.type]}\nClínica: ${input.clinicName}\nAtendente: ${input.userName}\n\n${input.description}`;
}
