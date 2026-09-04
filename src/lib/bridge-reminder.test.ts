import { describe, it, expect } from "vitest";
import { buildBridgeReminderMessage } from "./bridge-reminder";

describe("buildBridgeReminderMessage", () => {
  const base = {
    patientName: "Maria Silva",
    clinicName: "Urolaser",
    procedureName: "Ultrassom de Próstata",
    doctorName: "João Souza",
    time: "14:30",
    dateFormatted: "04/09/2026",
  };

  it("inclui procedimento, médico e horário quando presentes", () => {
    const message = buildBridgeReminderMessage(base);
    expect(message).toContain("Maria Silva");
    expect(message).toContain("Ultrassom de Próstata");
    expect(message).toContain("João Souza");
    expect(message).toContain("14:30");
    expect(message).toContain("04/09/2026");
    expect(message).toContain("Urolaser");
    expect(message).toContain("1️⃣");
    expect(message).toContain("2️⃣");
    expect(message).toContain("3️⃣");
    expect(message.toLowerCase()).toContain("remarcar");
  });

  it("não quebra quando procedimento, médico ou horário vêm vazios do Firebird", () => {
    const message = buildBridgeReminderMessage({
      ...base,
      procedureName: null,
      doctorName: null,
      time: null,
    });
    expect(message).toContain("Maria Silva");
    expect(message).toContain("04/09/2026");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});
