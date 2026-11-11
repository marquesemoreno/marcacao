import { describe, expect, it } from "vitest";
import { INSURANCE_REPLY_PREFIX, findMentionedInsurance, insuranceReply, isInsuranceQuestion, parseInsuranceList, shouldSendInsuranceReply } from "./insurance-reply";

const accepted = ["Unimed", "Bradesco Saúde", "Cassi", "Planserv"];

describe("isInsuranceQuestion", () => {
  it.each([
    "Vocês aceitam Unimed?",
    "aceita plano de saúde?",
    "Atende pelo Bradesco?",
    "vcs atendem convenio?",
    "Quais convênios vocês atendem",
    "trabalham com planserv?",
    "tem convênio com a cassi?",
    "Boa tarde, a clínica atende pela Hapvida?",
    "aceita unimed",
    "é pelo plano ou só particular?",
    "atende sulamerica?",
  ])("reconhece: %s", (msg) => {
    expect(isInsuranceQuestion(msg)).toBe(true);
  });

  it.each([
    "Bom dia, quero marcar uma consulta",
    "Meu convênio é Unimed", // informando, não perguntando
    "Segue a carteirinha do plano",
    "Onde fica a clínica?",
    "Já autorizaram no convênio?", // acompanhamento de autorização: é com a recepção
    "A guia do plano foi liberada?",
    "Qual o valor da consulta?",
    "ok obrigada",
  ])("não reconhece: %s", (msg) => {
    expect(isInsuranceQuestion(msg)).toBe(false);
  });

  it("ignora mensagem longa (formulário, texto colado)", () => {
    expect(isInsuranceQuestion("Vocês aceitam Unimed? " + "x".repeat(200))).toBe(false);
  });
});

describe("findMentionedInsurance", () => {
  it("acha o convênio aceito citado, sem ligar para acento e maiúscula", () => {
    expect(findMentionedInsurance("voces aceitam BRADESCO SAUDE?", accepted)).toEqual({ name: "Bradesco Saúde", accepted: true });
    expect(findMentionedInsurance("atende pelo bradesco?", accepted)).toEqual({ name: "Bradesco Saúde", accepted: true });
  });

  it("reconhece convênio conhecido que a clínica não atende", () => {
    expect(findMentionedInsurance("atende hapvida?", accepted)).toEqual({ name: "Hapvida", accepted: false });
    expect(findMentionedInsurance("aceita sul america?", accepted)).toEqual({ name: "SulAmérica", accepted: false });
  });

  it("sem convênio citado, não acha nada", () => {
    expect(findMentionedInsurance("aceita plano de saúde?", accepted)).toBeNull();
  });

  it("não confunde palavra parecida com nome curto de convênio", () => {
    expect(findMentionedInsurance("vocês aceitam cartão cassino?", accepted)).toBeNull();
  });
});

describe("insuranceReply", () => {
  it("convênio aceito: confirma", () => {
    const text = insuranceReply({ accepted, mentioned: { name: "Unimed", accepted: true }, note: "" });
    expect(text.startsWith(INSURANCE_REPLY_PREFIX)).toBe(true);
    expect(text).toContain("Atendemos sim pelo convênio Unimed");
  });

  it("convênio não aceito: diz que não e lista os que atende", () => {
    const text = insuranceReply({ accepted, mentioned: { name: "Hapvida", accepted: false }, note: "" });
    expect(text).toContain("não atendemos pelo convênio Hapvida");
    expect(text).toContain("Unimed, Bradesco Saúde, Cassi e Planserv");
  });

  it("pergunta geral: lista os convênios", () => {
    const text = insuranceReply({ accepted, mentioned: null, note: "" });
    expect(text).toContain("Convênios que atendemos: Unimed, Bradesco Saúde, Cassi e Planserv.");
  });

  it("acrescenta a observação da clínica no fim", () => {
    const text = insuranceReply({ accepted, mentioned: null, note: "Também atendemos particular." });
    expect(text.trim().endsWith("Também atendemos particular.")).toBe(true);
  });

  it("um convênio só não ganha 'e'", () => {
    expect(insuranceReply({ accepted: ["Unimed"], mentioned: null, note: "" })).toContain("Convênios que atendemos: Unimed.");
  });
});

describe("shouldSendInsuranceReply", () => {
  const now = new Date("2026-11-11T15:00:00Z");
  const base = { enabled: true, accepted, message: "aceita unimed?", lastReplyAt: null, now };

  it("responde quando ligado, com lista e pergunta de convênio", () => {
    expect(shouldSendInsuranceReply(base)).toBe(true);
  });

  it("não responde desligado, sem lista ou sem pergunta", () => {
    expect(shouldSendInsuranceReply({ ...base, enabled: false })).toBe(false);
    expect(shouldSendInsuranceReply({ ...base, accepted: [] })).toBe(false);
    expect(shouldSendInsuranceReply({ ...base, message: "bom dia" })).toBe(false);
  });

  it("no máximo uma vez a cada 12 horas por conversa", () => {
    expect(shouldSendInsuranceReply({ ...base, lastReplyAt: new Date("2026-11-11T10:00:00Z") })).toBe(false);
    expect(shouldSendInsuranceReply({ ...base, lastReplyAt: new Date("2026-11-10T15:00:00Z") })).toBe(true);
  });
});

describe("parseInsuranceList", () => {
  it("um por linha ou separado por vírgula, sem vazios nem repetidos, até 60", () => {
    expect(parseInsuranceList("Unimed\n  Cassi , Planserv\n\nunimed\n")).toEqual(["Unimed", "Cassi", "Planserv"]);
    expect(parseInsuranceList(Array.from({ length: 80 }, (_, i) => `Plano ${i}`).join("\n"))).toHaveLength(60);
  });

  it("corta nome grande demais", () => {
    expect(parseInsuranceList("x".repeat(100))[0]).toHaveLength(60);
  });
});
