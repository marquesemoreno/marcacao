import { errorSummary } from "@/lib/safe-error";
import "server-only";
import { prisma } from "@/lib/prisma";
import { stageFromStaffMessage } from "@/lib/auto-funnel-stage";
import { BUDGET_SENT_TAG, SCHEDULED_TAG } from "@/lib/conversation-tags";

/** Mensagem da equipe (Chat ou celular) com valor → Orçamento; "Agendado(a)…" → Agendado.
 * Só avança; não manda mensagem nenhuma ao paciente (diferente da troca manual de etapa).
 * Nunca lança. */
export async function applyAutoFunnelStage(conversationId: string, text: string, userId: string | null = null): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { funnelStage: true, tags: true },
    });
    if (!conversation) return;
    const next = stageFromStaffMessage(text, conversation.funnelStage);
    if (!next) return;
    const tag = next === "ORCAMENTO" ? BUDGET_SENT_TAG : SCHEDULED_TAG;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { funnelStage: next, ...(conversation.tags.includes(tag) ? {} : { tags: { push: tag } }) },
    });
    await prisma.conversationStageChange.create({
      data: { conversationId, fromStage: conversation.funnelStage, toStage: next, userId },
    });
  } catch (error) {
    console.error("[etapa automática] falha:", errorSummary(error));
  }
}
