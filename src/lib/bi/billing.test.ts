import { describe, expect, it } from "vitest";
import { businessDays, compareByBusinessDay, composeBilling, median, previousPeriod, flagAtypicalConvenios, summarizeGuias, trendPerBusinessDay } from "./billing";

describe("dias úteis (seg–sex, sem feriado nacional)", () => {
  it("outubro/2026 tem 21 dias úteis (12/10 é feriado)", () => {
    expect(businessDays("2026-10-01", "2026-10-31")).toBe(21);
  });
  it("novembro/2026: 02/11 e 20/11 caem em dia útil", () => {
    expect(businessDays("2026-11-01", "2026-11-30")).toBe(19);
  });
});

describe("período anterior", () => {
  it("mês fechado → mês anterior inteiro", () => {
    expect(previousPeriod("2026-10-01", "2026-10-31")).toEqual({ inicio: "2026-09-01", fim: "2026-09-30" });
    expect(previousPeriod("2026-03-01", "2026-03-31")).toEqual({ inicio: "2026-02-01", fim: "2026-02-28" });
  });
  it("janela livre → mesma quantidade de dias logo antes", () => {
    expect(previousPeriod("2026-10-10", "2026-10-19")).toEqual({ inicio: "2026-09-30", fim: "2026-10-09" });
  });
});

describe("comparação normalizada por dia útil", () => {
  it("compara a média por dia útil, nunca o total bruto", () => {
    // 21 dias úteis × 10 mil = 210 mil; anterior 22 dias × 10 mil = 220 mil → 0%, não −4,5%.
    expect(compareByBusinessDay({ total: 210_000, days: 21 }, { total: 220_000, days: 22 })).toEqual({
      perDay: 10_000,
      prevPerDay: 10_000,
      changePct: 0,
    });
  });
  it("sem dia útil ou sem base anterior, não inventa variação", () => {
    expect(compareByBusinessDay({ total: 100, days: 0 }, { total: 100, days: 5 }).changePct).toBeNull();
    expect(compareByBusinessDay({ total: 100, days: 5 }, { total: 0, days: 5 }).changePct).toBeNull();
  });
});

describe("mediana", () => {
  it("par e ímpar", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe("convênios atípicos", () => {
  const guias = [
    ...Array.from({ length: 20 }, () => ({ conv: "SUS", v: 10 })),
    ...[180, 200, 220, 210, 190, 205, 195, 185, 215, 230].map((v) => ({ conv: "UNIMED", v })),
    ...[150, 160, 170, 0, 0].map((v) => ({ conv: "CASSI", v })),
  ];
  it("valor repetido em quase todas as guias e mediana muito abaixo dos outros são sinalizados", () => {
    const flags = flagAtypicalConvenios(guias);
    const sus = flags.find((f) => f.convenio === "SUS")!;
    expect(sus.reasons).toEqual(expect.arrayContaining(["valor_repetido", "mediana_baixa"]));
    expect(sus.median).toBe(10);
    expect(flags.find((f) => f.convenio === "UNIMED")).toBeUndefined();
    expect(flags.find((f) => f.convenio === "CASSI")!.reasons).toEqual(["guias_zeradas"]);
    expect(flags.find((f) => f.convenio === "CASSI")!.zeroCount).toBe(2);
  });
});

describe("composição do faturamento (hipótese a confirmar)", () => {
  it("total = guias; internação e recibos aparecem como detalhe, sem somar de novo", () => {
    const c = composeBilling({
      guias: { qtd: 743, valor: 305_541.57, zeradas: 112 },
      internacoes: { qtd: 169, valor: 237_411.03, valorCasado: 199_046.15, qtdCasada: 126 },
      recibos: { qtd: 189, valor: 217_502.5, valorComGuia: 217_502.5 },
    });
    expect(c.total).toBe(305_541.57);
    expect(c.internacaoForaDasGuias).toBeCloseTo(38_364.88, 2);
    expect(c.reciboForaDasGuias).toBe(0);
    expect(c.toConfirm).toBe(true);
    expect(c.rules.map((r) => r.key)).toEqual(["total", "internacao", "recibos"]);
  });
});

describe("resumo das guias", () => {
  it("conta zeradas, soma valor e agrupa por convênio com nome e mediana", () => {
    const s = summarizeGuias(
      [
        ["2026-10-01", "1", 100],
        ["2026-10-02", "1", 300],
        ["2026-10-02", "1", 0],
        ["2026-10-03", "9", 50],
      ],
      { "1": "UNIMED" }
    );
    expect(s).toMatchObject({ qtd: 4, valor: 450, zeradas: 1 });
    expect(s.porConvenio[0]).toEqual({ id: "1", convenio: "UNIMED", qtd: 3, valor: 400, mediana: 200 });
    expect(s.porConvenio[1].convenio).toBe("Convênio 9");
  });
});

describe("tendência por dia útil", () => {
  it("divide cada mês pelos dias úteis e marca o mês corrente como parcial", () => {
    const t = trendPerBusinessDay([{ mes: "202610", qtd: 10, valor: 210_000 }], "2026-10-15");
    expect(t[0]).toMatchObject({ mes: "2026-10", dias: 10, partial: true });
    expect(t[0].porDia).toBeCloseTo(210_000 / 10, 2);
  });
});
