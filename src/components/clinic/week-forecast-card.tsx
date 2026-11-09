import type { WeekForecast } from "@/actions/week-forecast";

const WEEKDAY = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const fmtDay = (ymd: string) => {
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};
const n1 = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Próximos 7 dias: quantos agendados e quantos devem cancelar/remarcar ou não responder,
 * pela resposta ao lembrete nas últimas 3 semanas. */
export function WeekForecastCard({ data }: { data: WeekForecast }) {
  return (
    <section aria-labelledby="previsao-titulo" className="report-surface p-5">
      <h3 id="previsao-titulo" className="font-semibold">Previsão da semana</h3>
      {data.unavailable ? (
        <p className="mt-2 text-sm text-slate-500">Não deu para ler a agenda no computador da clínica agora. Tente mais tarde.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-slate-500">
            {data.total.toLocaleString("pt-BR")} agendados nos próximos 7 dias
            {data.historySample > 0 && (
              <> · com base em {data.historySample.toLocaleString("pt-BR")} lembretes das últimas 3 semanas</>
            )}
          </p>
          <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
            {data.days.map((d) => (
              <div key={d.date} className="rounded-xl bg-slate-100 dark:bg-slate-800/60 p-3">
                <p className="text-xs font-medium text-slate-500">{fmtDay(d.date)}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{d.total}</p>
                {d.expectedCancel !== null && d.total > 0 && (
                  <p className="text-xs text-slate-500 tabular-nums" title="Cancelar ou remarcar · não responder ao lembrete">
                    −{n1(d.expectedCancel)} · ?{n1(d.expectedNoReply ?? 0)}
                  </p>
                )}
              </div>
            ))}
          </div>
          {data.doctors.length > 0 && (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-500">
                    <th className="py-1.5 pr-3 text-left font-medium">Médico</th>
                    <th className="px-3 text-right font-medium">Agendados</th>
                    <th className="px-3 text-right font-medium">Cancela/remarca</th>
                    <th className="px-3 text-right font-medium">Não responde</th>
                    <th className="pl-3 text-right font-medium">Devem sair</th>
                  </tr>
                </thead>
                <tbody>
                  {data.doctors.slice(0, 12).map((d) => (
                    <tr key={d.doctor}>
                      <td className="py-1.5 pr-3">
                        {d.doctor}
                        {d.fromClinicRate && <span className="ml-1 text-xs text-slate-400" title="Pouco histórico: usa a média da clínica">*</span>}
                      </td>
                      <td className="px-3 text-right tabular-nums">{d.total}</td>
                      <td className="px-3 text-right tabular-nums">{d.cancelRate !== null ? `${n1(d.cancelRate)}%` : "—"}</td>
                      <td className="px-3 text-right tabular-nums">{d.noReplyRate !== null ? `${n1(d.noReplyRate)}%` : "—"}</td>
                      <td className="pl-3 text-right font-semibold tabular-nums">{d.expectedCancel !== null ? n1(d.expectedCancel) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            −: devem cancelar ou remarcar · ?: devem não responder ao lembrete (vale ligar). * pouco histórico, usa a média da clínica.
            A clínica não marca falta no sistema, então quem não responde é o melhor sinal de risco.
            {data.failedDays.length > 0 && <> Dias sem leitura da agenda: {data.failedDays.map(fmtDay).join(", ")}.</>}
          </p>
        </>
      )}
    </section>
  );
}

/** Carrega à parte (Suspense) — a ponte pode levar alguns segundos e não deve segurar o Relatório. */
export async function WeekForecastSection() {
  const { getWeekForecast } = await import("@/actions/week-forecast");
  const data = await getWeekForecast().catch(() => null);
  return data ? <WeekForecastCard data={data} /> : null;
}
