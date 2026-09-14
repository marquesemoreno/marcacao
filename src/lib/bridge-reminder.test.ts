import { describe, it, expect } from "vitest";
import { buildBridgeReminderMessage, buildUrolaserLaraReminderMessage, LARA_CONFIRMATION_MARKER } from "./bridge-reminder";

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
    const lines = message.split("\n").map((l) => l.trim());
    expect(lines).toContain("1️⃣ Digite 1 para Confirmar presença");
    expect(lines).toContain("2️⃣ Digite 2 para Remarcar");
    expect(lines).toContain("3️⃣ Digite 3 para Cancelar");
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

describe("buildUrolaserLaraReminderMessage", () => {
  const base = {
    patientName: "Vivaldo José de Oliveira",
    clinicName: "Urolaser",
    procedureName: "Ultrassom de Próstata",
    doctorName: "João Souza",
    time: "09:30",
    dateFormatted: "20/02/2026",
  };

  it("apresenta a Lara e inclui os dados do agendamento", () => {
    const message = buildUrolaserLaraReminderMessage(base);
    expect(message).toContain("Vivaldo José de Oliveira");
    expect(message).toContain("Lara");
    expect(message).toContain("Urolaser");
    expect(message).toContain("20/02/2026");
    expect(message).toContain("09:30");
    expect(message).toContain("horário para fazer a ficha");
    expect(message).toContain(LARA_CONFIRMATION_MARKER);
  });

  it("não usa menu numerado nem link/telefone externo", () => {
    const message = buildUrolaserLaraReminderMessage(base);
    expect(message).not.toMatch(/digite \d/i);
    expect(message).not.toContain("wa.me");
    expect(message).not.toMatch(/\(\d{2}\)\s?\d{4}/);
  });

  it("não quebra quando procedimento, médico ou horário vêm vazios do Firebird", () => {
    const message = buildUrolaserLaraReminderMessage({
      ...base,
      procedureName: null,
      doctorName: null,
      time: null,
    });
    expect(message).toContain("Vivaldo José de Oliveira");
    expect(message).toContain("20/02/2026");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});
