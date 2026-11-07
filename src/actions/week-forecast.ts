"use server";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { fetchBridgeDailyAgendaOrNull, hasHospitalBridgeIntegration } from "@/lib/hospital-bridge";
import { doctorLossRates, forecastWeek } from "@/lib/week-forecast";

const HISTORY_DAYS = 21;
const FORECAST_DAYS = 7;

/** AAAA-MM-DD no fuso de Brasília, `offset` dias a partir de hoje. */
function dayInBrazil(offset: number): string {
  const d = new Date(Date.now() - 3 * 3_600_000 + offset * 86_400_000);
  return d.toISOString().slice(0, 10);
}
const isSunday = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay() === 0;

async function compute(clinicId: string, today: string) {
  void today; // só faz parte da chave do cache
  const past = Array.from({ length: HISTORY_DAYS }, (_, i) => dayInBrazil(-(i + 1))).filter((d) => !isSunday(d));
  const next = Array.from({ length: FORECAST_DAYS }, (_, i) => dayInBrazil(i + 1)).filter((d) => !isSunday(d));
  const [pastAgendas, nextAgendas] = await Promise.all([
    Promise.all(past.map((d) => fetchBridgeDailyAgendaOrNull(clinicId, d))),
    Promise.all(next.map((d) => fetchBridgeDailyAgendaOrNull(clinicId, d))),
  ]);
  if (nextAgendas.every((a) => a === null)) return { unavailable: true as const };
  const pastAppts = pastAgendas.flatMap((a) => a ?? []);
  const logs = await prisma.bridgeReminderLog.findMany({
    where: { clinicId, bridgeNumero: { in: pastAppts.map((a) => a.numero) } },
    select: { bridgeNumero: true, response: true },
  });
  const rates = doctorLossRates(pastAppts, logs);
  const forecast = forecastWeek(
    next.map((date, i) => ({ date, appointments: nextAgendas[i] ?? [] })),
    rates
  );
  return {
    unavailable: false as const,
    ...forecast,
    failedDays: next.filter((_, i) => nextAgendas[i] === null),
    historySample: rates.clinic.sample,
  };
}

/** Previsão da semana para o Relatório: agenda dos próximos 7 dias (ponte) × perda histórica
 * por médico (resposta ao lembrete nas últimas 3 semanas). Cache de 3h — são ~25 leituras
 * da ponte no computador da clínica. null = clínica sem ponte. */
export async function getWeekForecast() {
  const { clinicId } = await requireClinicPermission("relatorios");
  if (!(await hasHospitalBridgeIntegration(clinicId))) return null;
  const today = dayInBrazil(0);
  return unstable_cache(compute, ["week-forecast", clinicId, today], { revalidate: 3 * 3600 })(clinicId, today);
}

export type WeekForecast = NonNullable<Awaited<ReturnType<typeof getWeekForecast>>>;
