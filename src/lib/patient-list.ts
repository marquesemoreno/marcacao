/** Lista de Pacientes (/clinic/contatos) como lista de trabalho da recepção: por padrão
 * quem está esperando resposta há mais tempo vem primeiro (crítica 15/10/2026). Puro. */

export type PatientSort = "espera" | "nome" | "recentes";
export const PATIENT_SORTS: { id: PatientSort; label: string }[] = [
  { id: "espera", label: "Esperando resposta" },
  { id: "recentes", label: "Conversa mais recente" },
  { id: "nome", label: "Nome (A–Z)" },
];

export type PatientSortItem = { id: string; name: string; lastAt: Date; waitingSince: Date | null };

export function sortPatientList<T extends PatientSortItem>(items: T[], sort: PatientSort): T[] {
  const byName = (a: T, b: T) => a.name.localeCompare(b.name, "pt-BR");
  const byRecent = (a: T, b: T) => b.lastAt.getTime() - a.lastAt.getTime();
  const copy = [...items];
  if (sort === "nome") return copy.sort(byName);
  if (sort === "recentes") return copy.sort(byRecent);
  return copy.sort((a, b) => {
    if (a.waitingSince && b.waitingSince) return a.waitingSince.getTime() - b.waitingSince.getTime();
    if (a.waitingSince) return -1;
    if (b.waitingSince) return 1;
    return byRecent(a, b);
  });
}
