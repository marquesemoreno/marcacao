/** CSV do /clinic/relatorio com o contexto no topo (crítica de Relatórios: o arquivo
 * exportado não dizia de qual período nem com quais filtros tinha sido gerado). */

export type ReportCsvContext = { clinic: string; periodLabel: string; filters: string[]; generatedAt: string };

const cell = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;

export function buildReportCsv(ctx: ReportCsvContext, rows: [string, string | number][]): string {
  return [
    `${cell("Clínica")},${cell(ctx.clinic)}`,
    `${cell("Período")},${cell(ctx.periodLabel)}`,
    `${cell("Filtros")},${cell(ctx.filters.length > 0 ? ctx.filters.join("; ") : "Nenhum")}`,
    `${cell("Gerado em")},${cell(ctx.generatedAt)}`,
    "",
    `${cell("Métrica")},${cell("Valor")}`,
    ...rows.map(([label, value]) => `${cell(label)},${cell(value)}`),
  ].join("\n");
}

export function reportCsvFilename(clinic: string, days: number, now: Date): string {
  const slug = clinic
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `relatorio-${slug}-${days}d-${now.toISOString().slice(0, 10)}.csv`;
}
