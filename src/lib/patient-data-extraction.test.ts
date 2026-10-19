import { describe, it, expect } from "vitest";
import { isValidCpf, extractPatientData } from "./patient-data-extraction";

describe("isValidCpf", () => {
  it("aceita CPF com dígitos verificadores corretos, com ou sem máscara", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224725")).toBe(true);
  });

  it("recusa dígito verificador errado, tamanho errado e sequência repetida", () => {
    expect(isValidCpf("529.982.247-24")).toBe(false);
    expect(isValidCpf("1234567890")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
  });
});

describe("extractPatientData", () => {
  it("acha o CPF no meio da frase e devolve formatado", () => {
    expect(extractPatientData("meu cpf é 52998224725, obrigada")).toEqual({ cpf: "529.982.247-25" });
    expect(extractPatientData("CPF: 529.982.247-25")).toEqual({ cpf: "529.982.247-25" });
  });

  it("ignora número de 11 dígitos que não é CPF válido (ex.: telefone)", () => {
    expect(extractPatientData("meu telefone é 77999990000")).toEqual({});
  });

  it("reconhece convênio conhecido, sem diferenciar caixa nem acento, com o nome padrão", () => {
    expect(extractPatientData("tenho UNIMED")).toEqual({ convenio: "Unimed" });
    expect(extractPatientData("meu plano é o bradesco saude")).toEqual({ convenio: "Bradesco Saúde" });
    expect(extractPatientData("sou da Sulamerica")).toEqual({ convenio: "SulAmérica" });
  });

  it("não sugere convênio quando o paciente diz que não tem", () => {
    expect(extractPatientData("não tenho unimed")).toEqual({});
    expect(extractPatientData("sem plano, mas antes tinha amil")).toEqual({ convenio: "Amil" });
  });

  it("extrai CPF e convênio da mesma mensagem", () => {
    expect(extractPatientData("Unimed, cpf 529.982.247-25")).toEqual({ cpf: "529.982.247-25", convenio: "Unimed" });
  });

  it("texto comum não gera sugestão", () => {
    expect(extractPatientData("bom dia, queria marcar uma consulta")).toEqual({});
    expect(extractPatientData("")).toEqual({});
  });

  it("não confunde palavra que contém o nome (ex.: 'cassino')", () => {
    expect(extractPatientData("fui ao cassino")).toEqual({});
  });
});
