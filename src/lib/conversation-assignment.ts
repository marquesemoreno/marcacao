/** Decide o valor de `assignmentSeenAt` quando uma conversa passa a ter um novo
 * `assignedUserId` específico (transferência entre atendentes, atribuição manual
 * do admin, ou o próprio atendente se atribuindo). `null` sinaliza "não vista" —
 * dispara o selo na lista e a notificação/som (ver refreshContacts em
 * chat-crm-app.tsx) pra quem recebeu, já que ela pode estar em outra aba/tela
 * nesse momento. Quando a pessoa se atribui a própria conversa, já está olhando
 * pra ela, não faz sentido avisar. */
export function assignmentSeenAtFor(newAssignedUserId: string, actingUserId: string): Date | null {
  return newAssignedUserId === actingUserId ? new Date() : null;
}

/** Quem RESPONDE o paciente vira a dona da conversa (09/10/2026: Jamile respondeu uma
 * paciente da Letícia e a conversa continuou com a Letícia — inclusive ao reabrir). Nota
 * interna não tira a conversa de ninguém, só assume se estiver sem dona. Espalhar no
 * `data` de um conversation.update. */
export function assignOnReply(
  conversation: { assignedUserId: string | null },
  userId: string,
  options?: { internalNote?: boolean }
): { assignedUserId: string; assignmentSeenAt: Date } | Record<string, never> {
  if (conversation.assignedUserId === userId) return {};
  if (options?.internalNote && conversation.assignedUserId) return {};
  return { assignedUserId: userId, assignmentSeenAt: new Date() };
}
