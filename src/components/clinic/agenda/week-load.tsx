"use client";

import { weekLoad, type AgendaItem } from "@/lib/agenda";
import { toTitleCase } from "@/lib/agenda-ui";

/** Semana como tabela de carga (médico × dia): onde tem vaga, qual dia está lotado.
 * Clicar numa célula abre o Dia daquele médico, com os nomes. */
export function WeekLoadTable({
  items,
  days,
  today,
  holidays,
  dayLabel,
  onOpenDay,
}: {
  items: AgendaItem[];
  days: string[];
  today: string;
  holidays: Set<string>;
  dayLabel: (iso: string) => string;
  onOpenDay: (date: string, doctor: string | null) => void;
}) {
  const load = weekLoad(items, days);
  // Intensidade em 4 degraus a partir da célula mais cheia da semana.
  const tone = (n: number) => {
    if (n === 0) return "text-slate-400 dark:text-slate-500";
    const r = n / Math.max(load.max, 1);
    if (r > 0.75) return "bg-emerald-200 text-emerald-950 dark:bg-emerald-800/70 dark:text-emerald-50";
    if (r > 0.5) return "bg-emerald-100 text-emerald-950 dark:bg-emerald-900/60 dark:text-emerald-100";
    if (r > 0.25) return "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200";
    return "text-slate-800 dark:text-slate-200";
  };

  if (load.rows.length === 0) {
    return <div className="glass-surface p-8 text-center text-sm text-slate-500 dark:text-slate-400">Nenhum paciente nesta semana.</div>;
  }

  return (
    <div className="overflow-x-auto glass-surface">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <caption className="sr-only">Pacientes por médico e dia. Clique numa célula para abrir o dia daquele médico.</caption>
        <thead>
          <tr className="border-b border-slate-900/[0.07] dark:border-white/[0.07]">
            <th scope="col" className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Médico</th>
            {days.map((d) => (
              <th
                key={d}
                scope="col"
                className={`px-2 py-2 text-center text-xs font-semibold ${d === today ? "text-emerald-800 dark:text-emerald-300" : "text-slate-700 dark:text-slate-300"}`}
              >
                <button type="button" onClick={() => onOpenDay(d, null)} className="rounded px-1 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                  {dayLabel(d)}
                </button>
                {holidays.has(d) && <span className="block text-xs font-medium text-amber-700 dark:text-amber-400">Feriado</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {load.rows.map((row) => {
            const name = row.doctor ? toTitleCase(row.doctor) : "Sem médico";
            return (
              <tr key={row.doctor ?? "—"} className="border-b border-slate-100 dark:border-slate-800/60">
                <th scope="row" className="max-w-[14rem] truncate px-3 py-1.5 text-left font-medium text-slate-800 dark:text-slate-100" title={name}>
                  {name}
                </th>
                {days.map((d) => {
                  const c = row.cells[d];
                  return (
                    <td key={d} className="p-0.5 text-center">
                      <button
                        type="button"
                        onClick={() => onOpenDay(d, row.doctor)}
                        className={`flex min-h-11 w-full flex-col items-center justify-center rounded-md px-1 tabular-nums hover:ring-1 hover:ring-slate-300 dark:hover:ring-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${tone(c.total)}`}
                        aria-label={`${name}, ${dayLabel(d)}: ${c.total} ${c.total === 1 ? "paciente" : "pacientes"}${c.aguardando ? `, ${c.aguardando} aguardando` : ""}${c.remarcar ? `, ${c.remarcar} quer remarcar` : ""}. Abrir o dia`}
                      >
                        <span className={c.total ? "text-base font-semibold" : ""}>{c.total || "–"}</span>
                        {(c.aguardando > 0 || c.remarcar > 0) && (
                          <span className="text-xs leading-tight">
                            {c.aguardando > 0 && <span className="text-amber-800 dark:text-amber-300">{c.aguardando} aguard.</span>}
                            {c.aguardando > 0 && c.remarcar > 0 && " · "}
                            {c.remarcar > 0 && <span className="font-semibold text-violet-800 dark:text-violet-300">{c.remarcar} remarcar</span>}
                          </span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className="px-3 py-2 text-left text-xs font-semibold text-slate-600 dark:text-slate-400">Total</th>
            {days.map((d) => (
              <td key={d} className="px-2 py-2 text-center text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                {load.totals[d]}
              </td>
            ))}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
