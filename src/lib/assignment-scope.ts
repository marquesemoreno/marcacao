/** Isolamento entre clínicas nas atribuições: o responsável por uma conversa é sempre da
 * clínica dela (ou um admin). Puro. */

type Assignee = { role: string; clinicId: string | null };

export function canAssignTo(target: Assignee | null | undefined, conversationClinicId: string): boolean {
  if (!target) return false;
  if (target.role === "ADMIN") return true;
  return target.clinicId === conversationClinicId;
}

/** Leitura defensiva: se a conversa (por dado antigo ou erro) aponta para atendente de OUTRA
 * clínica, ela aparece sem dono — o nome do funcionário de outra clínica nunca chega à tela. */
export function maskForeignAssignee<
  T extends { clinicId: string; assignedUserId: string | null; assignedUser: ({ role: string; clinicId: string | null } & Record<string, unknown>) | null },
>(conversation: T, viewerClinicId: string): T {
  if (!conversation.assignedUser) return conversation;
  if (canAssignTo(conversation.assignedUser, viewerClinicId)) return conversation;
  return { ...conversation, assignedUser: null, assignedUserId: null };
}
