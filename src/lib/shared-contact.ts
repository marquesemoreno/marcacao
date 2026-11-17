/** O cadastro do contato (nome + telefone) é UM só para todas as clínicas — a chave é o
 * telefone. Regras para uma clínica não ver nem estragar o que é da outra (auditoria de
 * segurança 16/11/2026, M2). Puro, sem banco. */

/** "Esse número já existe?" ao cadastrar: só responde com o nome se o paciente já tem
 * conversa NESTA clínica. Antes devolvia o nome gravado por outra clínica — dava para
 * descobrir, digitando telefones, quem é paciente de outra unidade. */
export function phoneCheckResult(
  contact: { name: string; conversations: { id: string }[] } | null,
): { name: string; conversationId: string } | null {
  const own = contact?.conversations[0];
  return contact && own ? { name: contact.name, conversationId: own.id } : null;
}

export const SHARED_PHONE_CHANGE_ERROR =
  "Este paciente também é atendido por outra unidade, então o número não pode ser trocado por aqui. Cadastre o número novo como um novo contato.";

/** Trocar o telefone muda o cadastro compartilhado: as mensagens da OUTRA clínica passariam
 * a ir para o número novo. Só pode quando o contato é só desta clínica. Reenviar o mesmo
 * número (o formulário sempre manda o telefone) não é troca. */
export function sharedPhoneChangeProblem(input: { currentPhone: string | null; newPhone: string | undefined; otherClinicConversations: number }): string | null {
  if (!input.newPhone || input.newPhone === input.currentPhone) return null;
  return input.otherClinicConversations > 0 ? SHARED_PHONE_CHANGE_ERROR : null;
}
