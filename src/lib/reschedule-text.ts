/** Texto do aviso de remarcação em massa. Esse aviso é transacional: sai SEM aceite de
 * marketing e sem responsável técnico (ver campaign-kind.ts). Por isso o texto precisa ser,
 * de fato, um aviso de remarcação — senão vira atalho para propaganda sem consentimento
 * (auditoria de segurança 16/11/2026, M4). Puro: a tela usa a mesma regra do servidor. */
export const RESCHEDULE_TEXT_MAX = 700;

export function rescheduleTextProblem(text: string): string | null {
  const t = text.trim();
  if (!t) return "Preencha o texto da mensagem.";
  if (t.length > RESCHEDULE_TEXT_MAX) return `O aviso pode ter até ${RESCHEDULE_TEXT_MAX} caracteres.`;
  if (!/\{\{\s*medico\s*\}\}/i.test(t)) return "O aviso precisa citar o médico: mantenha {{medico}} no texto.";
  if (!/\{\{\s*data\s*\}\}/i.test(t)) return "O aviso precisa citar o dia desmarcado: mantenha {{data}} no texto.";
  if (/https?:\/\/|www\./i.test(t)) return "O aviso de remarcação não pode ter link. Para divulgar algo, crie uma campanha.";
  return null;
}
