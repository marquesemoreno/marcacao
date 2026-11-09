import { describe, expect, it } from "vitest";
import { demoBridgeResponse } from "./demo-bridge";
import { flagAtypicalConvenios } from "./billing";
import type { BridgeBiBilling, BridgeFinanceSummary, BridgeStockSummary } from "@/lib/hospital-bridge";

const TODAY = "2026-11-09";
const billing = (q: string) => demoBridgeResponse(`/api/bi/faturamento?${q}`, TODAY) as BridgeBiBilling;

describe("modo demo da ponte (clínica de demonstração)", () => {
  it("é determinístico: mesma pergunta, mesmos números", () => {
    const q = "inicio=2026-10-01&fim=2026-10-31&tendenciaDesde=2025-10-01";
    const { geradoEm: _a, ...a } = billing(q);
    const { geradoEm: _b, ...b } = billing(q);
    expect(a).toEqual(b);
  });

  it("as guias do mês somam o mesmo que o mês na tendência", () => {
    const b = billing("inicio=2026-10-01&fim=2026-10-31&tendenciaDesde=2025-10-01");
    const soma = Math.round(b.guias.reduce((s, g) => s + g[2], 0) * 100) / 100;
    const out = b.tendencia.find((t) => t.mes === "202610")!;
    expect(out.valor).toBeCloseTo(soma, 2);
    expect(out.qtd).toBe(b.guias.length);
    expect(b.tendencia).toHaveLength(13);
  });

  it("não inventa guia no futuro nem em fim de semana/feriado", () => {
    const b = billing("inicio=2026-11-01&fim=2026-11-30&tendenciaDesde=2026-11-01");
    expect(b.guias.every(([d]) => d <= TODAY)).toBe(true);
    expect(b.guias.some(([d]) => d === "2026-11-02")).toBe(false); // Finados
    expect(b.guias.some(([d]) => d === "2026-11-07")).toBe(false); // sábado
    expect(b.ultimaGuia! <= TODAY).toBe(true);
  });

  it("tem os casos que a tela precisa mostrar: convênio atípico, internação casada, recibo de guia", () => {
    const b = billing("inicio=2026-10-01&fim=2026-10-31&tendenciaDesde=2026-10-01");
    const flags = flagAtypicalConvenios(b.guias.map(([, conv, v]) => ({ conv, v })));
    expect(flags.map((f) => b.convenios[f.convenio])).toContain("SUS");
    expect(b.internacoes.valorCasado).toBeLessThan(b.internacoes.valor);
    expect(b.internacoes.valorCasado).toBeGreaterThan(b.internacoes.valor * 0.7);
    expect(b.recibos.valorComGuia).toBeLessThanOrEqual(b.recibos.valor);
    expect(b.valorComMedico).toBeGreaterThan(0);
  });

  it("financeiro e estoque têm o formato da ponte; caminho desconhecido = null", () => {
    const f = demoBridgeResponse("/api/financeiro/resumo?inicio=2026-10-01&fim=2026-10-31", TODAY) as BridgeFinanceSummary;
    expect(f.receber.emitido).toBeGreaterThan(0);
    expect(f.planoDeContas.length).toBeGreaterThan(3);
    const s = demoBridgeResponse("/api/estoque/resumo", TODAY) as BridgeStockSummary;
    expect(s.maisUsados30.length).toBeGreaterThan(3);
    expect(demoBridgeResponse("/api/agenda/dia?data=2026-11-09", TODAY)).toBeNull();
  });
});
