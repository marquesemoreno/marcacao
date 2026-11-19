import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getClinicOccupancy, type OccupancyPeriod } from "@/actions/occupancy";
import { RoomsEditor } from "./rooms-editor";
import { biCard as card, brDate } from "./shared";

const PERIODS: { key: OccupancyPeriod; label: string }[] = [
  { key: "7", label: "Últimos 7 dias" },
  { key: "30", label: "Últimos 30 dias" },
  { key: "next7", label: "Próximos 7 dias" },
];
const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

const hours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/** Cor da célula do mapa: quanto mais ocupada, mais forte. */
function heatClass(rate: number | null): string {
  if (rate === null) return "bg-transparent text-slate-300 dark:text-slate-700";
  if (rate >= 80) return "bg-emerald-700 text-white";
  if (rate >= 50) return "bg-emerald-500 text-white";
  if (rate >= 25) return "bg-emerald-200 text-emerald-950 dark:bg-emerald-800 dark:text-emerald-50";
  if (rate > 0) return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100";
  return "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400";
}

export function parseOccupancyPeriod(raw?: string): OccupancyPeriod {
  return raw === "30" || raw === "next7" ? raw : "7";
}

/** Relatório › Ocupação: tempo marcado ÷ tempo em que cada sala funciona. */
export async function OccupancyTab({ period }: { period: OccupancyPeriod }) {
  const data = await getClinicOccupancy(period);
  const first = data.days[0];
  const last = data.days[data.days.length - 1];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Ocupação de consultórios e salas</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {brDate(first)} a {brDate(last)} · tempo marcado ÷ tempo em que a sala funciona · cada marcação conta a duração padrão da sala · feriados nacionais não contam
          </p>
        </div>
        <nav aria-label="Período" className="glass-surface !rounded-full flex gap-1 p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.key}
              href={`/clinic/relatorio?aba=ocupacao&periodo=${p.key}`}
              aria-current={p.key === period ? "page" : undefined}
              className={`rounded-full px-3 py-1.5 text-xs font-medium ${
                p.key === period ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-white/10"
              }`}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      </div>

      {data.bridgeFailedDays.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          Não deu para ler o sistema da clínica em {data.bridgeFailedDays.length} dia(s) ({data.bridgeFailedDays.map(brDate).join(", ")}) — o computador da clínica estava desligado ou fora do ar. A ocupação desses dias aparece menor do que foi.
        </p>
      )}

      {data.rooms.length > 0 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {data.rooms.map((r) => (
            <div key={r.id} className={`${card} space-y-3`}>
              <div>
                <p className="text-sm font-semibold">{r.name}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{r.kind === "PROCEDIMENTO" ? "Sala de exames/procedimentos" : "Consultório"}</p>
              </div>
              {r.availableMin === 0 ? (
                <p className="text-sm text-slate-600 dark:text-slate-400">Sem horário de funcionamento no período — cadastre abaixo.</p>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold tabular-nums">{r.rate}%</span>
                    <span className="text-xs text-slate-600 dark:text-slate-400">ocupada (marcado)</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-[4px] bg-slate-100 dark:bg-slate-800" role="progressbar" aria-valuenow={r.rate} aria-valuemin={0} aria-valuemax={100} aria-label={`Ocupação de ${r.name}`}>
                    <div className="h-full bg-emerald-600" style={{ width: `${Math.min(r.rate, 100)}%` }} />
                  </div>
                  <dl className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Efetiva (sem faltas)</dt>
                      <dd className="text-base font-semibold tabular-nums">{r.effectiveRate}%</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Ociosa</dt>
                      <dd className="text-base font-semibold tabular-nums">{hours(Math.max(r.availableMin - r.bookedMin, 0))}</dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Marcado / disponível</dt>
                      <dd className="tabular-nums">
                        {hours(r.bookedMin)} / {hours(r.availableMin)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-600 dark:text-slate-400">Faltas e cancelados</dt>
                      <dd className="tabular-nums">{hours(r.lostMin)}</dd>
                    </div>
                  </dl>
                  {r.rate > 100 && <p className="text-xs text-amber-700 dark:text-amber-400">Acima de 100%: há encaixes ou a duração padrão/horário cadastrado está curto.</p>}
                  {r.byDoctor.length > 0 && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-600 dark:text-slate-400">Por médico</summary>
                      <ul className="mt-1 space-y-0.5 tabular-nums">
                        {r.byDoctor.map((d) => (
                          <li key={d.doctor} className="flex justify-between gap-2">
                            <span className="truncate">{d.doctor}</span>
                            <span>{hours(d.bookedMin)}</span>
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {data.unassigned.count > 0 && (
        <p className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {data.unassigned.count} marcação(ões) ficaram sem sala
          {data.unassigned.doctors.length ? ` (${data.unassigned.doctors.join(", ")})` : ""}. Ligue o médico a um consultório ou o procedimento à sala de exames, abaixo.
        </p>
      )}

      {data.rooms.some((r) => r.availableMin > 0) && (
        <div className={`${card} space-y-3`}>
          <div>
            <h3 className="text-base font-semibold">Ocupação por dia da semana e hora</h3>
            <p className="text-xs text-slate-600 dark:text-slate-400">Células claras = horário ocioso. Marcações por ordem de chegada (sem hora) entram no total, não no mapa.</p>
          </div>
          {data.rooms
            .filter((r) => r.availableMin > 0)
            .map((r) => {
              const dayRows = [0, 1, 2, 3, 4, 5, 6].filter((d) => r.heat[d].some((c) => c.availableMin > 0));
              const hourCols = Array.from({ length: 24 }, (_, h) => h).filter((h) => dayRows.some((d) => r.heat[d][h].availableMin > 0));
              return (
                <div key={r.id} className="overflow-x-auto">
                  <table className="text-xs tabular-nums">
                    <caption className="mb-1 text-left text-sm font-medium">{r.name}</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="sr-only">Dia</th>
                        {hourCols.map((h) => (
                          <th key={h} scope="col" className="px-1 pb-1 font-normal text-slate-500 dark:text-slate-400">
                            {h}h
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dayRows.map((d) => (
                        <tr key={d}>
                          <th scope="row" className="pr-2 text-left font-medium text-slate-600 dark:text-slate-400">
                            {WEEK[d]}
                          </th>
                          {hourCols.map((h) => {
                            const c = r.heat[d][h];
                            const rate = c.availableMin > 0 ? Math.round((c.bookedMin / c.availableMin) * 100) : null;
                            return (
                              <td key={h} className="p-0.5">
                                <span
                                  title={rate === null ? "Fechada" : `${WEEK[d]} ${h}h: ${hours(c.bookedMin)} de ${hours(c.availableMin)}`}
                                  className={`flex h-7 w-10 items-center justify-center rounded ${heatClass(rate)}`}
                                >
                                  {rate === null ? "·" : `${rate}%`}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
        </div>
      )}

      <RoomsEditor rooms={data.roomsConfig} allDoctors={data.allDoctors} doctorRooms={data.doctorRooms} />
    </div>
  );
}
