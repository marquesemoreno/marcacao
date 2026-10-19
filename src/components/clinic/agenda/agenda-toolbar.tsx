"use client";

import { ChevronLeft, ChevronRight, ListChecks, Loader2, RefreshCw } from "lucide-react";

export type AgendaView = "dia" | "semana" | "mes" | "medico";

export const AGENDA_VIEWS: { id: AgendaView; label: string; key: string }[] = [
  { id: "dia", label: "Dia", key: "D" },
  { id: "semana", label: "Semana", key: "S" },
  { id: "mes", label: "Mês", key: "M" },
  { id: "medico", label: "Por médico", key: "P" },
];

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";

/** Barra de cima da Agenda: navegação de data e seletor de visão. Atalhos (ver
 * AgendaApp): ← → muda o período, H volta pra hoje, D/S/M/P troca a visão. */
export function AgendaToolbar({
  label,
  view,
  loading,
  onPrev,
  onToday,
  onNext,
  onView,
  onRefresh,
  onWaitlist,
  waitlistCount,
}: {
  label: string;
  view: AgendaView;
  loading: boolean;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  onView: (v: AgendaView) => void;
  onRefresh: () => void;
  onWaitlist: () => void;
  /** Pacientes aguardando vaga; null enquanto não carregou. */
  waitlistCount: number | null;
}) {
  const navBtn = `inline-flex items-center justify-center h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 ${focusRing}`;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={onPrev} className={`${navBtn} w-9`} aria-label="Período anterior" title="Anterior (←)">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={onToday} className={`${navBtn} px-3 text-sm font-medium`} title="Hoje (H)">
          Hoje
        </button>
        <button type="button" onClick={onNext} className={`${navBtn} w-9`} aria-label="Próximo período" title="Próximo (→)">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h1 className="ml-1 truncate text-lg md:text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-100 first-letter:uppercase" aria-live="polite">
          {label}
        </h1>
        <button
          type="button"
          onClick={onRefresh}
          className={`ml-1 inline-flex size-8 items-center justify-center rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-200 ${focusRing}`}
          aria-label={loading ? "Carregando agenda" : "Atualizar agenda"}
          title="Atualizar"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>
      <button
        type="button"
        onClick={onWaitlist}
        className={`${navBtn} gap-1.5 px-3 text-sm font-medium`}
        title="Pacientes esperando uma vaga abrir"
      >
        <ListChecks className="w-4 h-4" aria-hidden />
        Lista de espera{waitlistCount ? <span className="tabular-nums rounded-md bg-emerald-100 dark:bg-emerald-950/60 px-1.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300">{waitlistCount}</span> : null}
      </button>
      <div role="group" aria-label="Visão da agenda" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
        {AGENDA_VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={view === v.id}
            onClick={() => onView(v.id)}
            title={`${v.label} (${v.key})`}
            className={`px-3 h-8 text-sm font-medium rounded-md ${focusRing} ${
              view === v.id
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
