import { describe, it, expect } from "vitest";
import { stageMessageText, STAGE_MESSAGE_STAGES, normalizeStageMessageTemplate } from "./stage-messages";

describe("stageMessageText", () => {
  it("troca as variáveis e devolve o texto pronto para revisar", () => {
    expect(stageMessageText("Olá {{nome}}! Seu orçamento na {{clinica}} está pronto.", { nome: "Maria da Silva", clinica: "Urolaser" })).toEqual({
      text: "Olá Maria! Seu orçamento na Urolaser está pronto.",
      unresolved: [],
    });
  });

  it("avisa quais variáveis ficaram sem valor, para a recepção preencher antes de enviar", () => {
    expect(stageMessageText("Dr(a). {{medico}} te espera. {{nome}}, confirma?", { nome: "Ana" })).toEqual({
      text: "Dr(a). {{medico}} te espera. Ana, confirma?",
      unresolved: ["medico"],
    });
  });

  it("modelo vazio ou só espaços não gera mensagem", () => {
    expect(stageMessageText("   ", { nome: "Ana" })).toBeNull();
    expect(stageMessageText(null, { nome: "Ana" })).toBeNull();
  });
});

describe("normalizeStageMessageTemplate", () => {
  it("apara o texto e aceita só etapas que fazem sentido avisar o paciente", () => {
    expect(STAGE_MESSAGE_STAGES).toEqual(["orcamento", "agendado"]);
    expect(normalizeStageMessageTemplate("agendado", "  Oi {{nome}}  ")).toEqual({ ok: true, stage: "agendado", text: "Oi {{nome}}" });
    expect(normalizeStageMessageTemplate("novos", "Oi")).toEqual({ ok: false, error: "Etapa inválida." });
  });

  it("texto vazio significa 'sem mensagem nesta etapa'; texto enorme é recusado", () => {
    expect(normalizeStageMessageTemplate("orcamento", "  ")).toEqual({ ok: true, stage: "orcamento", text: "" });
    expect(normalizeStageMessageTemplate("orcamento", "x".repeat(1500))).toEqual({ ok: false, error: "Mensagem muito longa (máx. 1000 caracteres)." });
  });
});
