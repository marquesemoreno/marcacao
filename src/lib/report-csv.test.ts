import { describe, expect, it } from "vitest";
import { buildReportCsv, reportCsvFilename } from "./report-csv";

describe("buildReportCsv", () => {
  it("começa com o contexto (clínica, período, filtros, gerado em) e escapa aspas", () => {
    const csv = buildReportCsv(
      { clinic: "Urolaser", periodLabel: "Últimos 7 dias (29/09 a 06/10/2026)", filters: ["Canal: Instagram"], generatedAt: "06/10/2026 11:30" },
      [["Conversas no período", 120], ['Tag "VIP"', "—"]]
    );
    expect(csv.split("\n")).toEqual([
      '"Clínica","Urolaser"',
      '"Período","Últimos 7 dias (29/09 a 06/10/2026)"',
      '"Filtros","Canal: Instagram"',
      '"Gerado em","06/10/2026 11:30"',
      "",
      '"Métrica","Valor"',
      '"Conversas no período","120"',
      '"Tag ""VIP""","—"',
    ]);
  });
  it("sem filtros escreve 'Nenhum'", () => {
    expect(buildReportCsv({ clinic: "X", periodLabel: "P", filters: [], generatedAt: "G" }, []).split("\n")[2]).toBe('"Filtros","Nenhum"');
  });
});

describe("reportCsvFilename", () => {
  it("clínica, período e data no nome, sem acentos nem espaços", () => {
    expect(reportCsvFilename("Clínica Cirúrgica Santa Clara", 30, new Date("2026-10-06T14:00:00Z"))).toBe(
      "relatorio-clinica-cirurgica-santa-clara-30d-2026-10-06.csv"
    );
  });
});
