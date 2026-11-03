import { describe, expect, it } from "vitest";
import { can, parseClinicRole, CLINIC_ROLE_LABEL } from "./clinic-permissions";

describe("can", () => {
  it("recepção: atende e vê ficha, mas não dispara nem vê relatório", () => {
    expect(can("RECEPCAO", "atendimento")).toBe(true);
    expect(can("RECEPCAO", "ficha.ver")).toBe(true);
    expect(can("RECEPCAO", "disparos")).toBe(false);
    expect(can("RECEPCAO", "relatorios")).toBe(false);
    expect(can("RECEPCAO", "config")).toBe(false);
  });
  it("marketing: dispara e vê relatório, mas não vê ficha (dado de saúde) nem configura", () => {
    expect(can("MARKETING", "disparos")).toBe(true);
    expect(can("MARKETING", "relatorios")).toBe(true);
    expect(can("MARKETING", "atendimento")).toBe(true);
    expect(can("MARKETING", "ficha.ver")).toBe(false);
    expect(can("MARKETING", "config")).toBe(false);
  });
  it("gestão pode tudo", () => {
    for (const p of ["atendimento", "ficha.ver", "disparos", "relatorios", "config", "chamar"] as const) expect(can("GESTAO", p)).toBe(true);
  });
  it("médico: só chama os pacientes dele (painel da TV); sem chat, disparos ou relatórios", () => {
    expect(can("MEDICO", "chamar")).toBe(true);
    for (const p of ["atendimento", "ficha.ver", "disparos", "relatorios", "config"] as const) expect(can("MEDICO", p)).toBe(false);
  });
  it("recepção também chama na TV; marketing não", () => {
    expect(can("RECEPCAO", "chamar")).toBe(true);
    expect(can("MARKETING", "chamar")).toBe(false);
  });
});

describe("parseClinicRole", () => {
  it("valor desconhecido cai na função mais restrita", () => {
    expect(parseClinicRole("GESTAO")).toBe("GESTAO");
    expect(parseClinicRole("xyz")).toBe("RECEPCAO");
    expect(parseClinicRole(null)).toBe("RECEPCAO");
  });
  it("tem rótulo para cada função", () => {
    expect(CLINIC_ROLE_LABEL.MARKETING).toBe("Marketing");
  });
});
