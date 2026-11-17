import { describe, expect, it } from "vitest";
import { phoneCheckResult, SHARED_PHONE_CHANGE_ERROR, sharedPhoneChangeProblem } from "./shared-contact";

describe("phoneCheckResult", () => {
  it("número sem cadastro: livre", () => {
    expect(phoneCheckResult(null)).toBeNull();
  });
  it("paciente só de OUTRA clínica: responde como livre, sem o nome", () => {
    expect(phoneCheckResult({ name: "Maria de Outra Clínica", conversations: [] })).toBeNull();
  });
  it("paciente desta clínica: avisa e aponta a conversa", () => {
    expect(phoneCheckResult({ name: "Maria", conversations: [{ id: "c1" }] })).toEqual({ name: "Maria", conversationId: "c1" });
  });
});

describe("sharedPhoneChangeProblem", () => {
  it("contato também de outra clínica: não troca o número", () => {
    expect(sharedPhoneChangeProblem({ currentPhone: "5577999990000", newPhone: "5577988887777", otherClinicConversations: 1 })).toBe(SHARED_PHONE_CHANGE_ERROR);
  });
  it("contato só desta clínica: troca", () => {
    expect(sharedPhoneChangeProblem({ currentPhone: "5577999990000", newPhone: "5577988887777", otherClinicConversations: 0 })).toBeNull();
  });
  it("mesmo número reenviado pelo formulário não é troca", () => {
    expect(sharedPhoneChangeProblem({ currentPhone: "5577999990000", newPhone: "5577999990000", otherClinicConversations: 3 })).toBeNull();
  });
  it("sem telefone no envio: nada a conferir", () => {
    expect(sharedPhoneChangeProblem({ currentPhone: "5577999990000", newPhone: undefined, otherClinicConversations: 3 })).toBeNull();
  });
  it("contato de Instagram ganhando o primeiro telefone, sendo compartilhado: também não", () => {
    expect(sharedPhoneChangeProblem({ currentPhone: null, newPhone: "5577988887777", otherClinicConversations: 1 })).toBe(SHARED_PHONE_CHANGE_ERROR);
  });
});
