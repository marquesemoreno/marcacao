/** Normaliza pra comparação tolerante a acento/caixa — mesma técnica já usada em
 * src/lib/ai-attendant.ts (parseConsentReply). */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

/** Toda clínica tem uma conta genérica "Equipe {nome da clínica}" (convenção usada desde
 * o cadastro inicial) — "transferir" pra ela na prática significa devolver a conversa
 * pra fila geral (assignedUserId: null), não atribuir a essa conta como se fosse mais
 * um atendente. A comparação é tolerante a acento/espaço/caixa: um cadastro digitado
 * sem acento (ex: "Equipe Clinica Cirurgica Santa Clara" vs tradeName "Clínica Cirúrgica
 * Santa Clara") não pode fazer a conversa ficar presa nesse usuário fake pra sempre —
 * foi exatamente esse o bug real encontrado em produção pra Santa Clara. */
export function isTeamQueueUser(user: { name: string; clinic: { tradeName: string } | null }): boolean {
  if (!user.clinic) return false;
  return normalize(user.name) === normalize(`Equipe ${user.clinic.tradeName}`);
}

const TEAM_QUEUE_PREFIX = /^equipe\s+/i;

/** Rótulo pra exibir no lugar do nome cru da conta "Equipe X" no seletor de transferência
 * (ela representa a fila de Não Atribuídas, não deveria aparecer como se fosse mais um
 * atendente) — funciona pra qualquer clínica, não só a que tinha o bug de acento.
 * `clinicName` é opcional: só necessário numa lista que mistura várias clínicas (admin),
 * pra não mostrar "Não Atribuídas" repetido sem dizer de qual clínica é cada uma. */
export function formatAgentDisplayName(name: string, clinicName?: string): string {
  if (!TEAM_QUEUE_PREFIX.test(name.trim())) return name;
  return clinicName ? `Não Atribuídas — ${clinicName}` : "Não Atribuídas";
}
