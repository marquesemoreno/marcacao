import { describe, expect, it } from "vitest";
import { budgetOutcome, computeBudgetConversion } from "./budget-conversion";

const base = { value: 1000, scheduled: false, status: "OPEN", resolutionReason: null, followups: 0 };

describe("budgetOutcome", () => {
  it("agendou depois do orçamento = convertido", () => {
    expect(budgetOutcome({ ...base, scheduled: true })).toBe("convertido");
  });
  it("finalizada como Agendou = convertido", () => {
    expect(budgetOutcome({ ...base, status: "RESOLVED", resolutionReason: "AGENDAMENTO_CONCLUIDO" })).toBe("convertido");
  });
  it("finalizada com motivo de perda = perdido", () => {
    expect(budgetOutcome({ ...base, status: "RESOLVED", resolutionReason: "PERDA_PRECO" })).toBe("perdido");
    expect(budgetOutcome({ ...base, status: "RESOLVED", resolutionReason: "PERDA_CUSTOM:Mudou de cidade" })).toBe("perdido");
  });
  it("finalizada sem desfecho = perdido (sem resposta)", () => {
    expect(budgetOutcome({ ...base, status: "RESOLVED", resolutionReason: "SEM_RESPOSTA" })).toBe("perdido");
  });
  it("ainda aberta = em aberto", () => {
    expect(budgetOutcome(base)).toBe("aberto");
  });
});

describe("computeBudgetConversion", () => {
  it("vazio não divide por zero", () => {
    const r = computeBudgetConversion([]);
    expect(r.total).toBe(0);
    expect(r.rate).toBe(0);
  });

  it("totaliza quantidade, valor e taxa sobre os já decididos e sobre o total", () => {
    const r = computeBudgetConversion([
      { ...base, value: 2000, scheduled: true },
      { ...base, value: 1000, status: "RESOLVED", resolutionReason: "PERDA_PRECO" },
      { ...base, value: null },
      { ...base, value: 500, scheduled: true },
    ]);
    expect(r.total).toBe(4);
    expect(r.converted).toEqual({ count: 2, value: 2500 });
    expect(r.lost).toEqual({ count: 1, value: 1000 });
    expect(r.open).toEqual({ count: 1, value: 0 });
    expect(r.rate).toBe(50);
  });

  it("compara conversão com e sem cobrança", () => {
    const r = computeBudgetConversion([
      { ...base, followups: 1, scheduled: true },
      { ...base, followups: 2 },
      { ...base, followups: 0, status: "RESOLVED", resolutionReason: "PERDA_PRECO" },
      { ...base, followups: 0 },
    ]);
    expect(r.withFollowup).toEqual({ count: 2, rate: 50 });
    expect(r.withoutFollowup).toEqual({ count: 2, rate: 0 });
  });

  it("lista os motivos de perda mais comuns", () => {
    const lost = (reason: string) => ({ ...base, status: "RESOLVED", resolutionReason: reason });
    const r = computeBudgetConversion([lost("PERDA_PRECO"), lost("PERDA_PRECO"), lost("SEM_RESPOSTA")]);
    expect(r.lossReasons[0]).toMatchObject({ reason: "PERDA_PRECO", count: 2 });
    expect(r.lossReasons).toHaveLength(2);
  });
});
