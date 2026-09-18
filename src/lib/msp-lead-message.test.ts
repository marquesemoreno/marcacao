import { describe, it, expect } from "vitest";
import { buildMspOutreachMessage, isWithinOutreachWindow } from "./msp-lead-message";

describe("buildMspOutreachMessage", () => {
  it("substitui o nome do negócio no template fixo", () => {
    const message = buildMspOutreachMessage({ name: "Clínica Exemplo" });
    expect(message).toContain("Clínica Exemplo");
    expect(message).toContain("Aqui é o Lucas, da TIVDC");
    expect(message).not.toContain("{{name}}");
  });

  it("não gera preço nem link no primeiro contato", () => {
    const message = buildMspOutreachMessage({ name: "Clínica Exemplo" });
    expect(message).not.toMatch(/https?:\/\//);
    expect(message).not.toMatch(/R\$/);
  });
});

describe("isWithinOutreachWindow", () => {
  function atBahiaHour(hour: number): Date {
    // America/Bahia é UTC-3 o ano todo (sem horário de verão) — hora local `hour`
    // corresponde a `hour + 3` em UTC.
    return new Date(Date.UTC(2026, 8, 17, hour + 3, 0, 0));
  }

  it("permite das 9h às 12h", () => {
    expect(isWithinOutreachWindow(atBahiaHour(9))).toBe(true);
    expect(isWithinOutreachWindow(atBahiaHour(11))).toBe(true);
  });

  it("permite das 14h às 18h", () => {
    expect(isWithinOutreachWindow(atBahiaHour(14))).toBe(true);
    expect(isWithinOutreachWindow(atBahiaHour(17))).toBe(true);
  });

  it("bloqueia a abertura (8h-9h)", () => {
    expect(isWithinOutreachWindow(atBahiaHour(8))).toBe(false);
  });

  it("bloqueia o almoço (12h-14h)", () => {
    expect(isWithinOutreachWindow(atBahiaHour(12))).toBe(false);
    expect(isWithinOutreachWindow(atBahiaHour(13))).toBe(false);
  });

  it("bloqueia fora do expediente", () => {
    expect(isWithinOutreachWindow(atBahiaHour(19))).toBe(false);
    expect(isWithinOutreachWindow(atBahiaHour(6))).toBe(false);
  });
});
