import type { ConversationStatus } from "@prisma/client";
import { reopenIfResolved } from "@/lib/conversation-reopen";
import { RESCHEDULE_PENDING_TAG, nextTagsForOutcome } from "@/lib/conversation-tags";

/** Agendamento cancelado ou com falta: a conversa do paciente ganha "Remarcação Pendente"
 * (troca a tag de resultado anterior) e volta à fila — finalizada reabre sem dono, a que já
 * estava aberta mantém a atendente. É o par da mensagem que convida a remarcar
 * (ver REBOOK_INVITE em whatsapp-templates.ts). */
export function rebookingConversationUpdate(
  conversation: { status: ConversationStatus; tags: string[]; resolutionReason?: string | null; resolvedAt?: Date | null },
  now: Date = new Date()
) {
  return {
    ...reopenIfResolved(conversation, now),
    tags: nextTagsForOutcome(conversation.tags, RESCHEDULE_PENDING_TAG),
  };
}
