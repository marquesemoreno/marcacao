import { describe, expect, it, vi } from "vitest";
import { checkClinicalClaim, enforceClinicalGuard } from "./clinical-claim-guard";

describe("checkClinicalClaim — barra afirmação clínica", () => {
  it.each([
    ["Pelo que você descreveu, você tem cálculo renal.", "DIAGNOSTICO"],
    ["Você está com infecção urinária, com certeza.", "DIAGNOSTICO"],
    ["Isso parece ser uma prostatite.", "DIAGNOSTICO"],
    ["Esses sintomas indicam sinusite.", "DIAGNOSTICO"],
    ["Provavelmente é gastrite, viu?", "DIAGNOSTICO"],
    ["O senhor deve ter uma hérnia.", "DIAGNOSTICO"],
    ["Seu diagnóstico é hiperplasia benigna.", "DIAGNOSTICO"],
  ])("diagnóstico: %s", (text, reason) => {
    expect(checkClinicalClaim(text)).toMatchObject({ blocked: true, reason });
  });

  it.each([
    "Pode tomar dipirona enquanto isso.",
    "Tome um anti-inflamatório que melhora.",
    "Recomendo passar uma pomada no local.",
    "Use o antibiótico por 7 dias.",
    "Tome 500 mg de 8 em 8 horas.",
    "Pode tomar 40 gotas se doer.",
    "Indico tomar amoxicilina.",
  ])("remédio ou dose: %s", (text) => {
    expect(checkClinicalClaim(text)).toMatchObject({ blocked: true, reason: "MEDICACAO" });
  });

  it.each([
    "Garantimos o resultado da cirurgia.",
    "O resultado é garantido!",
    "A cirurgia tem 100% de sucesso.",
    "Esse tratamento vai curar o seu problema.",
    "É um procedimento sem nenhum risco.",
  ])("promessa de resultado: %s", (text) => {
    expect(checkClinicalClaim(text)).toMatchObject({ blocked: true, reason: "PROMESSA" });
  });

  it.each([
    "Fique tranquilo, essa pinta não é câncer.",
    "Isso deve ser benigno.",
    "Não é nada grave, pode ficar tranquila.",
    "Parece um tumor, melhor ver logo.",
  ])("gravidade ou câncer: %s", (text) => {
    expect(checkClinicalClaim(text)).toMatchObject({ blocked: true, reason: "GRAVIDADE" });
  });

  it.each([
    "Seu exame está normal.",
    "O seu PSA deu alto, precisa operar.",
    "O resultado veio alterado.",
  ])("interpretação de exame: %s", (text) => {
    expect(checkClinicalClaim(text)).toMatchObject({ blocked: true, reason: "EXAME" });
  });
});

describe("checkClinicalClaim — deixa passar o atendimento normal", () => {
  it.each([
    "O médico vai avaliar o seu caso na consulta.",
    "Você tem horário amanhã às 14h com o Dr. Paulo.",
    "O exame de PSA custa R$ 80,00.",
    "Traga seus exames anteriores e a lista dos remédios que você toma.",
    "Atendemos Unimed e Bradesco Saúde.",
    "Pode tomar seus remédios de uso contínuo normalmente.",
    "Para o ultrassom, beba 500 ml de água uma hora antes.",
    "O resultado do exame fica pronto em 5 dias úteis.",
    "Fazemos consulta para cálculo renal com o Dr. Paulo, quer marcar?",
    "Só o médico pode dizer se é câncer ou não, por isso vale marcar uma consulta.",
    "Não posso dizer o que você tem, mas posso marcar uma avaliação.",
    "Você está com a guia do convênio?",
    "Qual o limite de idade para a consulta?",
    "",
  ])("passa: %s", (text) => {
    expect(checkClinicalClaim(text)).toEqual({ blocked: false, reason: null });
  });
});

describe("enforceClinicalGuard", () => {
  it("resposta limpa sai como está, sem reescrever", async () => {
    const rewrite = vi.fn();
    const result = await enforceClinicalGuard("Temos horário amanhã às 9h.", rewrite);
    expect(result).toEqual({ text: "Temos horário amanhã às 9h.", firstBlock: null, finalBlock: null });
    expect(rewrite).not.toHaveBeenCalled();
  });

  it("resposta barrada é reescrita uma vez; se a nova passa, sai a nova", async () => {
    const rewrite = vi.fn().mockResolvedValue("Só o médico pode avaliar isso. Quer marcar uma consulta?");
    const result = await enforceClinicalGuard("Você tem cálculo renal.", rewrite);
    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(rewrite.mock.calls[0][0]).toMatch(/consulta/i);
    expect(result).toEqual({
      text: "Só o médico pode avaliar isso. Quer marcar uma consulta?",
      firstBlock: "DIAGNOSTICO",
      finalBlock: null,
    });
  });

  it("se a reescrita insiste, nada é enviado e o motivo volta", async () => {
    const rewrite = vi.fn().mockResolvedValue("Pode tomar dipirona.");
    const result = await enforceClinicalGuard("Você tem cálculo renal.", rewrite);
    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ text: null, firstBlock: "DIAGNOSTICO", finalBlock: "MEDICACAO" });
  });

  it("se a reescrita falha (null), nada é enviado", async () => {
    const rewrite = vi.fn().mockResolvedValue(null);
    const result = await enforceClinicalGuard("Garantimos o resultado.", rewrite);
    expect(result).toEqual({ text: null, firstBlock: "PROMESSA", finalBlock: "PROMESSA" });
  });
});
