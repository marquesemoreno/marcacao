import { describe, expect, it } from "vitest";
import { matchClinicalUrgency, EMERGENCY_GUIDANCE_MESSAGE } from "./clinical-urgency";

describe("matchClinicalUrgency", () => {
  it("sintoma grave e pedido de emergência viram urgência clínica", () => {
    expect(matchClinicalUrgency("estou com sangramento desde ontem")).not.toBeNull();
    expect(matchClinicalUrgency("Não consigo respirar direito")).not.toBeNull();
    expect(matchClinicalUrgency("meu pai desmaiou agora")).not.toBeNull();
    expect(matchClinicalUrgency("dor forte no peito")).not.toBeNull();
    expect(matchClinicalUrgency("é uma emergência")).not.toBeNull();
  });

  it("'urgente' de rotina, pedido de humano e reclamação NÃO são urgência clínica", () => {
    expect(matchClinicalUrgency("preciso remarcar urgente")).toBeNull();
    expect(matchClinicalUrgency("quero falar com atendente")).toBeNull();
    expect(matchClinicalUrgency("vou reclamar no procon")).toBeNull();
    expect(matchClinicalUrgency("ok, obrigado")).toBeNull();
  });

  it("mensagem de orientação cita o 192", () => {
    expect(EMERGENCY_GUIDANCE_MESSAGE).toContain("192");
  });
});
