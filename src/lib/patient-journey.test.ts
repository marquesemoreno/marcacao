import { describe, expect, it } from "vitest";
import { parseFormTemplate } from "./patient-form";
import {
  DEFAULT_ANAMNESE_TEMPLATE,
  DEFAULT_CONSENT_TERM,
  FORM_RETENTION_DAYS,
  checkinWindow,
  formLinkLine,
} from "./patient-journey";

describe("modelos padrão", () => {
  it("ficha padrão é um modelo válido", () => {
    expect(() => parseFormTemplate(DEFAULT_ANAMNESE_TEMPLATE)).not.toThrow();
  });
  it("termo cita dado de saúde, prazo de guarda e direitos do titular", () => {
    expect(DEFAULT_CONSENT_TERM.body).toMatch(/saúde/);
    expect(DEFAULT_CONSENT_TERM.body).toContain("1 ano");
    expect(DEFAULT_CONSENT_TERM.body).toMatch(/exclusão|excluir/);
    expect(FORM_RETENTION_DAYS).toBe(365);
  });
});

describe("checkinWindow", () => {
  // 2026-11-03 09:00 em Brasília = 12:00Z
  it("abre 2 h antes do horário e fecha no fim do dia", () => {
    expect(checkinWindow("2026-11-03", "09:00", new Date("2026-11-03T09:59:00Z"))).toBe("EARLY"); // 06:59
    expect(checkinWindow("2026-11-03", "09:00", new Date("2026-11-03T10:00:00Z"))).toBe("OPEN"); // 07:00
    expect(checkinWindow("2026-11-03", "09:00", new Date("2026-11-04T02:00:00Z"))).toBe("OPEN"); // 23:00
    expect(checkinWindow("2026-11-03", "09:00", new Date("2026-11-04T03:01:00Z"))).toBe("CLOSED"); // dia seguinte
  });
  it("sem horário (ordem de chegada): o dia todo", () => {
    expect(checkinWindow("2026-11-03", null, new Date("2026-11-03T09:30:00Z"))).toBe("OPEN");
    expect(checkinWindow("2026-11-03", null, new Date("2026-11-02T20:00:00Z"))).toBe("EARLY");
  });
});

describe("formLinkLine", () => {
  it("linha curta pro lembrete", () => {
    expect(formLinkLine("https://x.com/p/abc")).toBe(
      "📝 Para agilizar sua chegada, preencha a ficha antes da consulta: https://x.com/p/abc"
    );
  });
});
