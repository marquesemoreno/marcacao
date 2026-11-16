"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, Search } from "lucide-react";
import { openGlobalSearch } from "@/components/clinic/global-search";
import { isSettingsRoute } from "@/components/clinic/settings-sections";

/** N3 — cabeçalho padrão das telas do painel: título, subtítulo com número de contexto
 * ("833 pacientes", "38 em aberto") e a busca global (atalho "/"). */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const pathname = usePathname();
  // Telas que ficam dentro do hub de Configurações ganham o caminho de volta (16/11/2026).
  const showSettingsBack = isSettingsRoute(pathname) && pathname !== "/clinic/configuracoes";
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
      {/* min-w de ~16rem: com muitos filtros à direita (Relatório), o subtítulo não quebra palavra a palavra. */}
      <div className="min-w-0 lg:min-w-[16rem]">
        {showSettingsBack && (
          <Link
            href="/clinic/configuracoes"
            prefetch={false}
            className="mb-1 inline-flex items-center gap-0.5 rounded-full text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
            Configurações
          </Link>
        )}
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <button
          type="button"
          onClick={openGlobalSearch}
          className="inline-flex items-center gap-2 h-9 rounded-full bg-slate-100 dark:bg-slate-800 px-4 text-sm text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
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
