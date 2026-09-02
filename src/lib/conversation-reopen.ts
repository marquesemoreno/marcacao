import type { ConversationStatus } from "@prisma/client";

/** Chamado quando uma nova mensagem do paciente chega (webhook do WhatsApp). Se a
 * conversa estava RESOLVED, reabre e libera o atendente (assignedUserId: null) —
 * quem resolveu antes pode não estar mais online (ex: turno da manhã), e sem isso
 * a conversa reaberta nunca aparecia em "Não Atribuídas" pra outra pessoa pegar.
 * Também limpa os campos de resolução, que ficariam desatualizados numa conversa
 * que voltou a ficar aberta (mesma limpeza já feita no reopen manual do admin). */
export function reopenIfResolved(conversation: { status: ConversationStatus }) {
  if (conversation.status !== "RESOLVED") {
    return { status: conversation.status };
  }
  return {
    status: "OPEN" as const,
    assignedUserId: null,
    resolvedAt: null,
    resolutionReason: null,
    resolutionNotes: null,
  };
}
