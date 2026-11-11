/** Tarefas da recepção (/clinic/tarefas): uma lista de tarefas com prazo e responsável,
 * criada à mão ou pelas automações (ação "Lembrar a recepção"). Regras puras aqui. */

export type TaskBucket = "OVERDUE" | "TODAY" | "UPCOMING" | "DONE";

export const TASK_TEXT_MAX = 300;

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000;
const brtDay = (d: Date) => new Date(d.getTime() - BRT_OFFSET_MS).toISOString().slice(0, 10);

/** Em que grupo a tarefa aparece. O dia é o de Brasília; sem prazo conta como "próximos". */
export function taskBucket(r: { done: boolean; dueAt: Date | null }, now: Date): TaskBucket {
  if (r.done) return "DONE";
  if (!r.dueAt) return "UPCOMING";
  const due = brtDay(r.dueAt);
  const today = brtDay(now);
  return due < today ? "OVERDUE" : due === today ? "TODAY" : "UPCOMING";
}

export function groupTasks<T extends { done: boolean; dueAt: Date | null }>(rows: T[], now: Date): Record<TaskBucket, T[]> {
  const groups: Record<TaskBucket, T[]> = { OVERDUE: [], TODAY: [], UPCOMING: [], DONE: [] };
  // Prazo mais antigo primeiro; sem prazo por último.
  const sorted = [...rows].sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
  for (const r of sorted) groups[taskBucket(r, now)].push(r);
  return groups;
}

export function validateTaskInput(input: { text: string; dueDate: string | null }): string | null {
  const text = input.text.trim();
  if (!text) return "Escreva a tarefa.";
  if (text.length > TASK_TEXT_MAX) return `A tarefa tem até ${TASK_TEXT_MAX} letras.`;
  if (input.dueDate && !dueDateToInstant(input.dueDate)) return "Prazo inválido. Escolha uma data.";
  return null;
}

/** "AAAA-MM-DD" (campo de data) → instante do fim daquele dia em Brasília (23:59). */
export function dueDateToInstant(dueDate: string | null): Date | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const d = new Date(`${dueDate}T23:59:00-03:00`);
  if (Number.isNaN(d.getTime()) || brtDay(d) !== dueDate) return null;
  return d;
}

/** Instante → "AAAA-MM-DD" em Brasília (para preencher o campo de data). */
export function instantToDueDate(dueAt: Date | null): string {
  return dueAt ? brtDay(dueAt) : "";
}

/** Último instante de hoje em Brasília: tudo com prazo até aqui está "para hoje ou atrasado". */
export function endOfBrtDay(now: Date): Date {
  return new Date(new Date(`${brtDay(now)}T00:00:00-03:00`).getTime() + 86_400_000 - 1);
}
