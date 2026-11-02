"use client";

import type { DaySummary } from "@/lib/agenda";
import { AGENDA_STATUS_GROUPS } from "@/lib/agenda-ui";

/** Faixa de resumo acima da grade: quantos aguardam confirmação, querem remarcar,
 * confirmaram, chegaram… Cada contagem filtra a grade (clique de novo limpa). Também
 * serve de legenda das cores. "Quer remarcar" ganha destaque quando há alguém — é o
 * único status que pede ação da recepção. */
export function AgendaSummary({
  summary,
  activeGroups,
  onToggle,
  lateCount = 0,
  lateActive = false,
  onToggleLate,
}: {
  summary: DaySummary;
  activeGroups: string[];
  onToggle: (id: string) => void;
  /** Hoje: quem já devia ter chegado (horário + 15 min) e não chegou. */
  lateCount?: number;
  lateActive?: boolean;
  onToggleLate?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Resumo e filtro por status">
      <span className="mr-1 text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
        {summary.total} {summary.total === 1 ? "paciente" : "pacientes"}
      </span>
      {onToggleLate && (lateCount > 0 || lateActive) && (
        <button
          type="button"
          aria-pressed={lateActive}
          onClick={onToggleLate}
          className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
            lateActive
              ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
              : "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-200"
          }`}
        >
          <span className="size-2 rounded-full bg-amber-500" aria-hidden />
          {lateCount} {lateCount === 1 ? "atrasado" : "atrasados"}
        </button>
      )}
      {AGENDA_STATUS_GROUPS.map((g) => {
        const n = summary[g.id];
        const active = activeGroups.includes(g.id);
        // Crítica 02/11 (6ª): 7 chips quase todos em 0 de manhã eram ruído. Zerado some
        // (a não ser que esteja filtrando).
        if (n === 0 && !active) return null;
        const urgent = g.id === "remarcar" && n > 0;
        return (
          <button
            key={g.id}
            type="button"
            aria-pressed={active}
            onClick={() => { if (n > 0 || active) onToggle(g.id); }}
            aria-disabled={n === 0 && !active}
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium tabular-nums transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 aria-disabled:opacity-45 aria-disabled:cursor-default ${
              active
                ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900"
                : urgent
                  ? "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-300"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            <span className={`size-2 rounded-full ${g.dot}`} aria-hidden />
            <span className="font-semibold">{n}</span> {g.label.toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}
