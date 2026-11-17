import { describe, expect, it } from "vitest";
import { shouldRecordAccess, accessActionLabel } from "./access-log";

const now = new Date("2026-10-20T12:00:00Z");

describe("shouldRecordAccess", () => {
  it("leitura repetida na mesma hora não grava de novo", () => {
    expect(shouldRecordAccess("ABRIU_CONVERSA", new Date("2026-10-20T11:30:00Z"), now)).toBe(false);
  });
  it("leitura depois de 1 hora ou sem registro anterior grava", () => {
    expect(shouldRecordAccess("ABRIU_FICHA", new Date("2026-10-20T10:59:00Z"), now)).toBe(true);
    expect(shouldRecordAccess("ABRIU_CONVERSA", null, now)).toBe(true);
  });
  it("edição sempre grava", () => {
    expect(shouldRecordAccess("EDITOU_CADASTRO", new Date("2026-10-20T11:59:00Z"), now)).toBe(true);
  });
  it("rótulos em português", () => {
    expect(accessActionLabel("ABRIU_FICHA")).toBe("Abriu a ficha");
  });
});

describe("acessos do suporte e em lote (auditoria 16/11/2026, M9)", () => {
  it("edição feita pelo suporte sempre grava", () => {
    expect(shouldRecordAccess("SUPORTE_EDITOU_CADASTRO", new Date("2026-10-20T11:59:00Z"), now)).toBe(true);
  });
  it("leitura do suporte conta 1× por hora, como a da clínica", () => {
    expect(shouldRecordAccess("SUPORTE_ABRIU_CONVERSA", new Date("2026-10-20T11:30:00Z"), now)).toBe(false);
    expect(shouldRecordAccess("SUPORTE_ABRIU_CONVERSA", null, now)).toBe(true);
  });
  it("rótulos deixam claro quem acessou e o quê", () => {
    expect(accessActionLabel("SUPORTE_ABRIU_CONVERSA")).toMatch(/suporte/i);
    expect(accessActionLabel("SUPORTE_EDITOU_CADASTRO")).toMatch(/suporte/i);
    expect(accessActionLabel("VIU_RESUMO_AGENDA")).toMatch(/agenda/i);
    expect(accessActionLabel("LISTOU_PACIENTES")).toMatch(/lista/i);
    expect(accessActionLabel("BUSCOU_PACIENTES")).toMatch(/busc/i);
  });
});
