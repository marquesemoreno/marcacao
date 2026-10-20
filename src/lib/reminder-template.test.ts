import { describe, expect, it } from "vitest";
import { reminderTemplateParams } from "./reminder-template";

describe("reminderTemplateParams", () => {
  it("nome, data, horário e médico na ordem do modelo", () => {
    expect(
      reminderTemplateParams({ patientName: "Maria Souza", dateFormatted: "22/10", time: "14:00", doctorName: "Dr. Ademir", procedureName: "Consulta" })
    ).toEqual(["Maria Souza", "22/10", "14:00", "Dr. Ademir"]);
  });
  it("sem médico usa o procedimento; sem horário, 'horário marcado'", () => {
    expect(reminderTemplateParams({ patientName: "Ana", dateFormatted: "22/10", time: null, doctorName: null, procedureName: "Ultrassom" })).toEqual([
      "Ana",
      "22/10",
      "horário marcado",
      "Ultrassom",
    ]);
  });
});
