import "server-only";
import { prisma } from "@/lib/prisma";
import { askJevChoice } from "@/lib/jev";
import { intentFromJevAnswer, PATIENT_INTENT_QUESTION } from "@/lib/patient-intent";

/** Classifica a intenção atual do paciente (últimas 3 mensagens de texto recebidas) e
 * grava na conversa. Chamado depois da resposta do webhook (next/server `after`) — nunca
 * atrasa nem derruba o recebimento da mensagem. Jev indisponível = não grava nada. */
export async function classifyAndStorePatientIntent(conversationId: string): Promise<void> {
  try {
    const recent = await prisma.message.findMany({
      where: { conversationId, direction: "INBOUND", type: "TEXT", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { content: true },
    });
    if (recent.length === 0) return;
    const mensagens = recent.reverse().map((m) => m.content.slice(0, 500));
    const result = intentFromJevAnswer(await askJevChoice({ mensagens }, PATIENT_INTENT_QUESTION));
    if (!result) return;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { patientIntent: result.intent, patientIntentConfidence: result.confidence, patientIntentAt: new Date() },
    });
  } catch (error) {
    console.error("Falha ao classificar intenção do paciente:", error);
  }
}
