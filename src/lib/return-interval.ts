/** Intervalo de retorno (fase 4 da jornada, 02/11/2026): por procedimento quando a consulta
 * tem um (marcações do Conecta), senão pelo médico (código do sistema da clínica na régua,
 * nome na agenda), senão o padrão do passo "Retorno" da régua. */

export type ReturnInterval = { kind: "DOCTOR" | "PROCEDURE"; key: string; label: string; days: number };

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

export function resolveReturnDays(
  ref: { procedureId?: string | null; doctorCode?: string | null; doctorName?: string | null },
  intervals: ReturnInterval[],
  fallback: number,
): number {
  if (ref.procedureId) {
    const p = intervals.find((i) => i.kind === "PROCEDURE" && i.key === ref.procedureId);
    if (p) return p.days;
  }
  const code = ref.doctorCode?.trim();
  if (code) {
    const d = intervals.find((i) => i.kind === "DOCTOR" && i.key.trim() === code);
    if (d) return d.days;
  }
  if (ref.doctorName?.trim()) {
    const name = norm(ref.doctorName);
    const d = intervals.find((i) => i.kind === "DOCTOR" && norm(i.label) === name);
    if (d) return d.days;
  }
  return fallback;
}

export function validateReturnDays(days: number): string | null {
  return Number.isInteger(days) && days >= 7 && days <= 1095 ? null : "Use entre 7 e 1095 dias.";
}

/** AAAA-MM-DD da consulta + dias. */
export function returnDueDate(visitDate: string, days: number): string {
  const d = new Date(`${visitDate}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Tela Retorno: o sistema da clínica lista "médicos" que não atendem (faturamento,
 * convênios). Ativo = é o médico da última consulta de algum paciente (ou já tem intervalo).
 * Sem dados de pacientes (ponte fora), nada é escondido. */
export function rankDoctors<T extends { key: string; label: string; days: number | null }>(
  doctors: T[],
  lastDoctorCodes: string[] | null,
): (T & { active: boolean; patients: number })[] {
  const count = new Map<string, number>();
  for (const c of lastDoctorCodes ?? []) {
    const k = c.trim();
    if (k) count.set(k, (count.get(k) ?? 0) + 1);
  }
  return doctors
    .map((d) => {
      const patients = count.get(d.key.trim()) ?? 0;
      return { ...d, patients, active: lastDoctorCodes === null || patients > 0 || d.days !== null };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || b.patients - a.patients || a.label.localeCompare(b.label, "pt-BR"));
}
