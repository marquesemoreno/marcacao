import { describe, expect, it } from "vitest";
import { DEMO_CLOUD_TEMPLATES, demoRuleAudienceCount } from "./demo-regua";

describe("modo demo da régua", () => {
  it("modelos de exemplo contam os {{n}} do texto", () => {
    expect(DEMO_CLOUD_TEMPLATES.length).toBeGreaterThanOrEqual(4);
    for (const t of DEMO_CLOUD_TEMPLATES) {
      expect(t.variableCount).toBe(new Set(t.bodyText.match(/\{\{\d+\}\}/g) ?? []).size);
      expect(t.variableCount).toBeGreaterThan(0);
    }
  });

  it("prévia é determinística para o mesmo dia", () => {
    expect(demoRuleAudienceCount("RETORNO", 180, "2026-11-09")).toBe(demoRuleAudienceCount("RETORNO", 180, "2026-11-09"));
  });

  it("prévia fica num número plausível (1 a 40)", () => {
    for (const kind of ["POS_CONSULTA", "RETORNO", "REATIVACAO", "NPS", "ANIVERSARIO"] as const) {
      for (const d of [1, 7, 180, 365, 1095]) {
        const n = demoRuleAudienceCount(kind, d, "2026-11-09");
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(40);
      }
    }
  });

  it("muda quando os dias mudam (a prévia reage ao campo)", () => {
    const counts = new Set([30, 60, 90, 120, 180].map((d) => demoRuleAudienceCount("RETORNO", d, "2026-11-09")));
    expect(counts.size).toBeGreaterThan(1);
  });
});
