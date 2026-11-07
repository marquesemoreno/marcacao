/** Previsão da semana (Etapa 5.4, 07/11/2026): agenda dos próximos dias × quanto cada médico
 * costuma perder. As clínicas quase não marcam falta no sistema, então a "perda" vem da
 * resposta ao lembrete D-1 das últimas semanas: cancelou/remarcou (perda certa) e não
 * respondeu (risco). Médico com pouca amostra usa a taxa da clínica. Puro e testado. */

export const MIN_SAMPLE = 10;
export const NO_DOCTOR = "Sem médico";

type Appt = { numero: number; medico: string | null };
type Log = { bridgeNumero: number; response: string | null };
export type LossCount = { sample: number; cancelled: number; noReply: number };
export type LossRates = { byDoctor: Map<string, LossCount>; clinic: LossCount };

const doctorOf = (a: Appt) => a.medico?.trim() || NO_DOCTOR;

export function doctorLossRates(past: Appt[], logs: Log[]): LossRates {
  const response = new Map(logs.map((l) => [l.bridgeNumero, l.response]));
  const byDoctor = new Map<string, LossCount>();
  const clinic: LossCount = { sample: 0, cancelled: 0, noReply: 0 };
  for (const a of past) {
    if (!response.has(a.numero)) continue; // sem lembrete enviado, nada a medir
    const r = response.get(a.numero);
    const d = byDoctor.get(doctorOf(a)) ?? { sample: 0, cancelled: 0, noReply: 0 };
    for (const c of [d, clinic]) {
      c.sample++;
      if (r === "CANCELLED" || r === "RESCHEDULE") c.cancelled++;
      else if (!r) c.noReply++;
    }
    byDoctor.set(doctorOf(a), d);
  }
  return { byDoctor, clinic };
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export type ForecastDay = { date: string; total: number; expectedCancel: number | null; expectedNoReply: number | null };
export type ForecastDoctor = {
  doctor: string;
  total: number;
  cancelRate: number | null;
  noReplyRate: number | null;
  expectedCancel: number | null;
  fromClinicRate: boolean;
};

export function forecastWeek(days: { date: string; appointments: Appt[] }[], rates: LossRates) {
  const rateFor = (doctor: string) => {
    const own = rates.byDoctor.get(doctor);
    if (own && own.sample >= MIN_SAMPLE) return { c: own.cancelled / own.sample, n: own.noReply / own.sample, fromClinic: false };
    if (rates.clinic.sample === 0) return null;
    return { c: rates.clinic.cancelled / rates.clinic.sample, n: rates.clinic.noReply / rates.clinic.sample, fromClinic: true };
  };

  const doctors = new Map<string, number>();
  const outDays: ForecastDay[] = days.map(({ date, appointments }) => {
    let c = 0;
    let n = 0;
    let known = appointments.length === 0;
    for (const a of appointments) {
      const doc = doctorOf(a);
      doctors.set(doc, (doctors.get(doc) ?? 0) + 1);
      const r = rateFor(doc);
      if (!r) continue;
      known = true;
      c += r.c;
      n += r.n;
    }
    return { date, total: appointments.length, expectedCancel: known ? round1(c) : null, expectedNoReply: known ? round1(n) : null };
  });

  const outDoctors: ForecastDoctor[] = [...doctors.entries()]
    .map(([doctor, total]) => {
      const r = rateFor(doctor);
      return {
        doctor,
        total,
        cancelRate: r ? round1(r.c * 100) : null,
        noReplyRate: r ? round1(r.n * 100) : null,
        expectedCancel: r ? round1(r.c * total) : null,
        fromClinicRate: r?.fromClinic ?? false,
      };
    })
    .sort((a, b) => (b.expectedCancel ?? 0) - (a.expectedCancel ?? 0) || b.total - a.total);

  return { days: outDays, doctors: outDoctors, total: outDays.reduce((s, d) => s + d.total, 0) };
}
