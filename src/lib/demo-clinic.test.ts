import { describe, expect, it } from "vitest";
import { isDemoClinicCnpj } from "./demo-clinic";

describe("isDemoClinicCnpj", () => {
  it("reconhece o CNPJ fixo da clínica demo", () => {
    expect(isDemoClinicCnpj("00.000.000/0001-00")).toBe(true);
  });
  it("não confunde clínica real nem CNPJ vazio", () => {
    expect(isDemoClinicCnpj("12.345.678/0001-90")).toBe(false);
    expect(isDemoClinicCnpj(null)).toBe(false);
    expect(isDemoClinicCnpj(undefined)).toBe(false);
  });
});
