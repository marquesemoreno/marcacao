import { describe, expect, it } from "vitest";
import { parseFormTemplate, validateFormAnswers, type FormQuestion } from "./patient-form";

const questions: FormQuestion[] = [
  { id: "queixa", label: "Qual o motivo da consulta?", type: "text", required: true },
  { id: "alergia", label: "Tem alergia a algum medicamento?", type: "yesno", required: true },
  { id: "quais", label: "Quais?", type: "text", required: false, showIf: { id: "alergia", equals: "sim" } },
  { id: "dor", label: "Nível de dor", type: "choice", options: ["nenhuma", "leve", "forte"], required: false },
];

describe("parseFormTemplate", () => {
  it("aceita modelo válido", () => {
    expect(parseFormTemplate({ questions }).questions).toHaveLength(4);
  });
  it("recusa ids repetidos e escolha sem opções", () => {
    expect(() => parseFormTemplate({ questions: [questions[0], questions[0]] })).toThrow();
    expect(() => parseFormTemplate({ questions: [{ id: "x", label: "X", type: "choice", required: true }] })).toThrow();
  });
});

describe("validateFormAnswers", () => {
  it("ok com obrigatórias preenchidas; descarta chaves desconhecidas e apara texto", () => {
    const r = validateFormAnswers(questions, { queixa: "  dor nas costas ", alergia: "nao", intruso: "x" });
    expect(r).toEqual({ ok: true, answers: { queixa: "dor nas costas", alergia: "nao" } });
  });
  it("aponta obrigatória vazia", () => {
    const r = validateFormAnswers(questions, { queixa: " ", alergia: "sim" });
    expect(r).toEqual({ ok: false, errors: { queixa: "Obrigatório" } });
  });
  it("valor fora das opções é erro", () => {
    const r = validateFormAnswers(questions, { queixa: "a", alergia: "talvez", dor: "média" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["alergia", "dor"]);
  });
  it("pergunta condicional escondida é ignorada", () => {
    const r = validateFormAnswers(questions, { queixa: "a", alergia: "nao", quais: "dipirona" });
    expect(r).toEqual({ ok: true, answers: { queixa: "a", alergia: "nao" } });
  });
  it("texto longo é cortado no limite", () => {
    const r = validateFormAnswers(questions, { queixa: "x".repeat(5000), alergia: "nao" });
    expect(r.ok && r.answers.queixa.length).toBe(2000);
  });
});
