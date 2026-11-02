import { describe, it, expect } from "vitest";
import { ruleTargetDate, ruleCampaignName, DEFAULT_RULE_STEPS, validateRuleInput } from "./automation-rules";

describe("ruleTargetDate", () => {
  it("conta os dias no horário de Brasília", () => {
    // 01/11 02:00 UTC ainda é 31/10 em Brasília
    expect(ruleTargetDate(new Date("2026-11-01T02:00:00Z"), 1)).toBe("2026-10-30");
    expect(ruleTargetDate(new Date("2026-11-01T12:00:00Z"), 1)).toBe("2026-10-31");
    expect(ruleTargetDate(new Date("2026-11-01T12:00:00Z"), 180)).toBe("2026-05-05");
  });
});

describe("ruleCampaignName", () => {
  it("leva o nome do passo e a data", () => {
    expect(ruleCampaignName("Pós-consulta", new Date("2026-11-01T12:00:00Z"))).toBe("Régua · Pós-consulta · 01/11");
  });
});

describe("DEFAULT_RULE_STEPS", () => {
  it("pós-consulta não exige estar sem consulta futura; retorno e reativação exigem", () => {
    const byKind = Object.fromEntries(DEFAULT_RULE_STEPS.map((s) => [s.kind, s]));
    expect(byKind.POS_CONSULTA.requireNoFuture).toBe(false);
    expect(byKind.RETORNO.requireNoFuture).toBe(true);
    expect(byKind.REATIVACAO.requireNoFuture).toBe(true);
    expect(byKind.RETORNO.daysAfter).toBeLessThan(byKind.REATIVACAO.daysAfter);
  });
});

describe("validateRuleInput", () => {
  it("aceita dias entre 1 e 1095", () => {
    expect(validateRuleInput({ daysAfter: 0 })).toMatch(/dias/);
    expect(validateRuleInput({ daysAfter: 2000 })).toMatch(/dias/);
    expect(validateRuleInput({ daysAfter: 7 })).toBeNull();
  });
});
