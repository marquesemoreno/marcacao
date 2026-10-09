import type { ConversationStatus } from "@prisma/client";

/** Chamado quando uma nova mensagem do paciente chega (webhook do WhatsApp). Se a
 * conversa estava RESOLVED, reabre e libera o atendente (assignedUserId: null) —
 * quem resolveu antes pode não estar mais online (ex: turno da manhã), e sem isso
 * a conversa reaberta nunca aparecia em "Não Atribuídas" pra outra pessoa pegar.
 * Também limpa os campos de resolução, que ficariam desatualizados numa conversa
 * que voltou a ficar aberta (mesma limpeza já feita no reopen manual do admin). */
/** Finalizações automáticas (cron conversation-auto-close): o paciente que responde
 * depois volta pra MESMA atendente se for em até 48h — a conversa só foi fechada por
 * tempo, a atendente continua sendo a dona. */
const AUTO_CLOSE_REASONS = ["INATIVIDADE", "ATENDIMENTO_CONCLUIDO"];
const KEEP_ASSIGNEE_MS = 48 * 3600_000;

export function reopenIfResolved(
  conversation: { status: ConversationStatus; resolutionReason?: string | null; resolvedAt?: Date | null },
  now: Date = new Date()
) {
  if (conversation.status !== "RESOLVED") {
    return { status: conversation.status };
  }
  const recentAutoClose =
    !!conversation.resolutionReason &&
    AUTO_CLOSE_REASONS.includes(conversation.resolutionReason) &&
    !!conversation.resolvedAt &&
    now.getTime() - conversation.resolvedAt.getTime() < KEEP_ASSIGNEE_MS;
  if (recentAutoClose) {
    return { status: "OPEN" as const, resolvedAt: null, resolutionReason: null, resolutionNotes: null };
  }
  return {
    status: "OPEN" as const,
    assignedUserId: null,
    resolvedAt: null,
    resolutionReason: null,
    resolutionNotes: null,
  };
}
