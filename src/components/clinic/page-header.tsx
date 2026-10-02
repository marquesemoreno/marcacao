"use client";

import { Search } from "lucide-react";
import { openGlobalSearch } from "@/components/clinic/global-search";

/** N3 — cabeçalho padrão das telas do painel: título, subtítulo com número de contexto
 * ("833 pacientes", "38 em aberto") e a busca global (atalho "/"). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <button
          type="button"
          onClick={openGlobalSearch}
          className="inline-flex items-center gap-2 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm text-slate-500 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-600"
          aria-label="Buscar paciente, telefone ou conversa (atalho /)"
        >
          <Search className="w-4 h-4" />
          <span className="hidden sm:inline">Buscar</span>
          <kbd className="ml-2 hidden sm:inline rounded border border-slate-300 dark:border-slate-700 px-1.5 text-xs">/</kbd>
        </button>
      </div>
    </div>
  );
}
