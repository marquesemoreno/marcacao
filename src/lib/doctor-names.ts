/** A lista de "médicos" vem do campo livre Appointment.doctorName, que nas clínicas com
 * bridge é o nome da agenda no Firebird (tabela MEDICOS) — e lá também existem agendas
 * de procedimento/exame que não são médicos (ex: "PROCEDIMENTO UROLOGICO"). F4: separa
 * as duas pra não aparecerem misturadas nos filtros. */
const AGENDA_PREFIXES = ["procedimento", "procedimentos", "exame", "exames", "agenda", "sala", "ultrassom", "ultrasson", "raio"];

const normalize = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function isProcedureAgenda(name: string): boolean {
  const first = normalize(name).split(/\s+/)[0] ?? "";
  return AGENDA_PREFIXES.includes(first);
}

export function splitDoctorAgendas(names: string[]) {
  const doctors: string[] = [];
  const agendas: string[] = [];
  for (const n of names) (isProcedureAgenda(n) ? agendas : doctors).push(n);
  const byName = (a: string, b: string) => a.localeCompare(b, "pt-BR");
  return { doctors: doctors.sort(byName), agendas: agendas.sort(byName) };
}
