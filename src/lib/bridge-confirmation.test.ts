import { describe, it, expect } from "vitest";
import {
  buildBridgeConfirmationMessage,
  buildBridgeConfirmationFollowUp,
  UROLASER_RETURN_POLICY_NOTICE,
} from "./bridge-confirmation";

describe("buildBridgeConfirmationMessage", () => {
  const base = {
    patientName: "Maria Silva",
    doctorName: "Alan Pascoal Silva Santos",
    dateFormatted: "08/09/2026",
    time: "08:00",
  };

  it("monta a mensagem com paciente, data, horário e médico", () => {
    const message = buildBridgeConfirmationMessage(base);
    expect(message).toContain("Maria Silva");
    expect(message).toContain("Alan Pascoal Silva Santos");
    expect(message).toContain("08/09/2026");
    expect(message).toContain("08:00");
  });

  it("não inclui nenhum aviso de política quando policyNotice não é passado (Santa Clara/RC)", () => {
    const message = buildBridgeConfirmationMessage(base);
    expect(message).not.toContain("📌");
    expect(message).not.toContain("30 dias");
  });

  it("inclui o aviso de política só quando policyNotice é passado (Urolaser)", () => {
    const message = buildBridgeConfirmationMessage({ ...base, policyNotice: UROLASER_RETURN_POLICY_NOTICE });
    expect(message).toContain("30 dias para retorno");
    expect(message).toContain("Formas de pagamento");
  });

  it("mostra 'Por ordem de chegada' quando não tem horário marcado (modo Chegada no modal)", () => {
    const message = buildBridgeConfirmationMessage({ ...base, time: null });
    expect(message).toContain("Por ordem de chegada");
  });

  it("não pede pra confirmar/remarcar/cancelar (isso é só no lembrete D-1, não faz sentido logo após agendar)", () => {
    const message = buildBridgeConfirmationMessage(base);
    expect(message).not.toContain("Digite 1");
    expect(message).not.toContain("Digite 2");
    expect(message).not.toContain("Digite 3");
  });

  it("deixa o nome do médico em title case quando vem em CAIXA ALTA do Firebird (bug real: marcação de teste com nome do médico gritando)", () => {
    const message = buildBridgeConfirmationMessage({ ...base, doctorName: "LIVIA VASCONCELOS CUNHA OLIVEIRA" });
    expect(message).toContain("Livia Vasconcelos Cunha Oliveira");
    expect(message).not.toContain("LIVIA VASCONCELOS");
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
