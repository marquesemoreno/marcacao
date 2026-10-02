import { describe, it, expect } from "vitest";
import { isProcedureAgenda, splitDoctorAgendas } from "./doctor-names";

describe("splitDoctorAgendas", () => {
  it("separa agendas de procedimento dos médicos", () => {
    expect(isProcedureAgenda("PROCEDIMENTO UROLOGICO")).toBe(true);
    expect(isProcedureAgenda("Exames de Imagem")).toBe(true);
    expect(isProcedureAgenda("JOSE VIEIRA OLIVEIRA")).toBe(false);
    expect(splitDoctorAgendas(["PROCEDIMENTO UROLOGICO", "LUCIANO MARTINS", "ANA LIMA"])).toEqual({
      doctors: ["ANA LIMA", "LUCIANO MARTINS"],
      agendas: ["PROCEDIMENTO UROLOGICO"],
    });
  });
});
