import { describe, it, expect } from "vitest";
import { buildBridgeConfirmationMessage } from "./bridge-confirmation";

describe("buildBridgeConfirmationMessage", () => {
  const base = {
    patientName: "Maria Silva",
    procedureName: "Consulta Urologia",
    doctorName: "Alan Pascoal Silva Santos",
    dateFormatted: "08/09/2026",
    time: "08:00",
  };

  it("monta a mensagem com procedimento, médico, data e horário, negritos balanceados", () => {
    const message = buildBridgeConfirmationMessage(base);
    expect(message).toContain("Consulta Urologia");
    expect(message).toContain("Alan Pascoal Silva Santos");
    expect(message).toContain("08/09/2026");
    expect(message).toContain("08:00");
    expect(message).toContain("por ordem de chegada");
    // Mesmo bug do template original (asteriscos ímpares) não pode se repetir aqui.
    const asteriscos = message.match(/\*/g)?.length ?? 0;
    expect(asteriscos % 2).toBe(0);
  });

  it("não menciona Valor R$ (removido a pedido)", () => {
    const message = buildBridgeConfirmationMessage(base);
    expect(message).not.toMatch(/valor/i);
  });

  it("não quebra sem médico ou horário (nem sempre vêm do bridge)", () => {
    const message = buildBridgeConfirmationMessage({ ...base, doctorName: null, time: null });
    expect(message).toContain("Consulta Urologia");
    expect(message).toContain("08/09/2026");
    expect(message).not.toContain("null");
    expect(message).not.toContain("undefined");
  });
});
