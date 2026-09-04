import { describe, it, expect } from "vitest";
import { buildBridgeConfirmationMessage, buildBridgeConfirmationFollowUp } from "./bridge-confirmation";

describe("buildBridgeConfirmationMessage", () => {
  const base = {
    patientName: "Maria Silva",
    clinicName: "Clínica Urolaser",
    doctorName: "Alan Pascoal Silva Santos",
    dateFormatted: "08/09/2026",
    time: "08:00",
  };

  it("monta a mensagem com paciente, clínica, data, horário e médico", () => {
    const message = buildBridgeConfirmationMessage(base);
    expect(message).toContain("Maria Silva");
    expect(message).toContain("Clínica Urolaser");
    expect(message).toContain("Alan Pascoal Silva Santos");
    expect(message).toContain("08/09/2026");
    expect(message).toContain("08:00");
  });

  it("dá as três opções com emoji numerado, na ordem certa (1 confirmar / 2 remarcar / 3 cancelar)", () => {
    const message = buildBridgeConfirmationMessage(base);
    const lines = message.split("\n").map((l) => l.trim());
    expect(lines).toContain("1️⃣ Digite 1 para Confirmar presença");
    expect(lines).toContain("2️⃣ Digite 2 para Remarcar");
    expect(lines).toContain("3️⃣ Digite 3 para Cancelar");
  });

  it("não quebra sem médico ou horário (nem sempre vêm do bridge)", () => {
    const message = buildBridgeConfirmationMessage({ ...base, doctorName: null, time: null });
    expect(message).toContain("Maria Silva");
    expect(message).toContain("08/09/2026");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});

describe("buildBridgeConfirmationFollowUp", () => {
  it("agradece e inclui o endereço", () => {
    const message = buildBridgeConfirmationFollowUp({
      address: "Av. Otávio Santos, 395, 2º andar, sala 202",
      neighborhood: "Recreio",
      city: "Vitória da Conquista",
    });
    expect(message.toLowerCase()).toContain("agradecemos a confirmação");
    expect(message).toContain("Av. Otávio Santos, 395, 2º andar, sala 202");
    expect(message).toContain("Recreio");
  });

  it("não quebra sem endereço cadastrado", () => {
    const message = buildBridgeConfirmationFollowUp({ address: null, neighborhood: null, city: null });
    expect(message.toLowerCase()).toContain("agradecemos a confirmação");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});
