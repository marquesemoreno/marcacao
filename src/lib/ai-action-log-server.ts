import { prisma } from "@/lib/prisma";

/** Grava uma ação da IA para a tela /clinic/ia. Nunca derruba o fluxo que a chamou. */
export async function logAiAction(input: {
  clinicId: string;
  conversationId: string;
  kind: "APPT_CONFIRMED" | "APPT_CANCELLED" | "APPT_RESCHEDULE" | "AI_REPLIED" | "AI_ESCALATED";
  summary: string;
  confidence?: number | null;
}) {
  try {
    await prisma.aiActionLog.create({
      data: {
        clinicId: input.clinicId,
        conversationId: input.conversationId,
        kind: input.kind,
        summary: input.summary.slice(0, 1000),
        confidence: input.confidence ?? null,
      },
    });
  } catch (error) {
    console.error("Falha ao registrar ação da IA:", error);
  }
}
