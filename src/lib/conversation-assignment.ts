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
