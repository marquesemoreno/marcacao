"use client";

import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";

export type AgendaView = "dia" | "semana" | "mes" | "medico";

const VIEWS: { id: AgendaView; label: string }[] = [
  { id: "dia", label: "Dia" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
  { id: "medico", label: "Por médico" },
];

/** Barra de cima da Agenda: navegação de data e seletor de visão. */
export function AgendaToolbar({
  label,
  view,
  loading,
  onPrev,
  onToday,
  onNext,
  onView,
  onRefresh,
}: {
  label: string;
  view: AgendaView;
  loading: boolean;
  onPrev: () => void;
  onToday: () => void;
  onNext: () => void;
  onView: (v: AgendaView) => void;
  onRefresh: () => void;
}) {
  const navBtn =
    "inline-flex items-center justify-center h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 min-w-0">
        <button type="button" onClick={onPrev} className={`${navBtn} w-9`} aria-label="Anterior">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button type="button" onClick={onToday} className={`${navBtn} px-3 text-sm font-medium`}>
          Hoje
        </button>
        <button type="button" onClick={onNext} className={`${navBtn} w-9`} aria-label="Próximo">
          <ChevronRight className="w-4 h-4" />
        </button>
        <h1 className="ml-1 truncate text-base md:text-lg font-semibold tracking-tight text-slate-900 dark:text-slate-100 first-letter:uppercase">
          {label}
        </h1>
        <button
          type="button"
          onClick={onRefresh}
          className="ml-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          aria-label="Atualizar agenda"
          title="Atualizar"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </button>
      </div>
      <div role="tablist" aria-label="Visão" className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 p-0.5">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            role="tab"
            type="button"
            aria-selected={view === v.id}
            onClick={() => onView(v.id)}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md ${
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
