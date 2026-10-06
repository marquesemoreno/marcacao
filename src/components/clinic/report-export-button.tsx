"use client";

import { Download } from "lucide-react";
import { buildReportCsv, reportCsvFilename } from "@/lib/report-csv";

/** Monta e baixa um CSV com as métricas já carregadas na página — sem round-trip
 * ao servidor, os dados exibidos já são exatamente os do período filtrado. O arquivo
 * começa com clínica, período, filtros e hora de geração (ver report-csv.ts). */
export function ReportExportButton({
  rows,
  clinic,
  days,
  filters,
}: {
  rows: [string, string | number][];
  clinic: string;
  days: number;
  filters: string[];
}) {
  function handleExport() {
    const now = new Date();
    const fmt = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const since = new Date(now.getTime() - days * 86_400_000);
    const csv = buildReportCsv(
      {
        clinic,
        periodLabel: `Últimos ${days} dias (${fmt(since)} a ${fmt(now)})`,
        filters,
        generatedAt: now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
      },
      rows,
    );
    const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = reportCsvFilename(clinic, days, now);
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors shadow-xs"
    >
      <Download className="w-3.5 h-3.5" aria-hidden />
      Exportar CSV
    </button>
  );
}
