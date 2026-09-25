"use client";

import { Download } from "lucide-react";

/** Monta e baixa um CSV com as métricas já carregadas na página — sem round-trip
 * ao servidor, os dados exibidos já são exatamente os do período filtrado. */
export function ReportExportButton({ rows }: { rows: [string, string | number][] }) {
  function handleExport() {
    const csv = ["Métrica,Valor", ...rows.map(([label, value]) => `"${label}","${value}"`)].join("\n");
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `relatorio-clinica-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
    >
      <Download className="w-3.5 h-3.5" />
      Exportar CSV
    </button>
  );
}
