"use client";

import type { AgendaItem } from "@/lib/agenda";
import { AGENDA_STATUS_GROUPS } from "@/lib/agenda-ui";

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Visão Mês: quantos pacientes por dia, com a contagem por grupo de status. Clique no
 * dia abre a visão Dia. */
export function AgendaMonth({
  days,
  month,
  today,
  selected,
  items,
  failedDays,
  onPickDay,
}: {
  days: string[];
  month: string; // AAAA-MM
  today: string;
  selected: string;
  items: AgendaItem[];
  failedDays: string[];
  onPickDay: (day: string) => void;
}) {
  const byDay = new Map<string, AgendaItem[]>();
  for (const i of items) byDay.set(i.date, [...(byDay.get(i.date) ?? []), i]);

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const list = byDay.get(day) ?? [];
          const inMonth = day.startsWith(month);
          const isSunday = new Date(`${day}T12:00:00Z`).getUTCDay() === 0;
          return (
            <button
              key={day}
              type="button"
              onClick={() => onPickDay(day)}
              className={`min-h-24 border-b border-r border-slate-100 dark:border-slate-800 p-2 text-left align-top hover:bg-slate-50 dark:hover:bg-slate-800/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                inMonth ? "" : "bg-slate-50/60 dark:bg-slate-950/40"
              } ${day === selected ? "ring-2 ring-inset ring-emerald-500/50" : ""}`}
              aria-label={`${day.split("-").reverse().join("/")}: ${list.length} pacientes`}
            >
              <span
                className={`inline-flex size-6 items-center justify-center rounded-full text-xs tabular-nums ${
                  day === today
                    ? "bg-emerald-600 text-white font-semibold"
                    : inMonth
                      ? "text-slate-700 dark:text-slate-200"
                      : "text-slate-400 dark:text-slate-600"
                }`}
              >
                {Number(day.slice(8))}
              </span>
              {failedDays.includes(day) ? (
                <p className="mt-1 text-[10px] text-amber-700 dark:text-amber-400">Agenda da clínica fora do ar</p>
              ) : list.length > 0 ? (
                <div className="mt-1 space-y-0.5">
                  <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                    {list.length} {list.length === 1 ? "paciente" : "pacientes"}
                  </p>
                  <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                    {AGENDA_STATUS_GROUPS.map((g) => {
                      const n = list.filter((i) => g.statuses.includes(i.status)).length;
                      if (!n) return null;
                      return (
                        <span key={g.id} className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 tabular-nums">
                          <span className={`size-1.5 rounded-full ${g.dot}`} aria-hidden />
                          {n}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                !isSunday && inMonth && <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-600">Livre</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
