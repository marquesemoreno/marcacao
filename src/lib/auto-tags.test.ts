import { describe, it, expect } from "vitest";
import { detectProcedureInterestTag, detectSourceTag } from "./auto-tags";

describe("detectProcedureInterestTag", () => {
  it("detecta procedimento mencionado na mensagem", () => {
    expect(detectProcedureInterestTag("Quero fazer um ultrassom")).toBe("🩺 Interesse: Ultrassom");
  });

  it("é case-insensitive", () => {
    expect(detectProcedureInterestTag("PRECISO DE UM HEMOGRAMA urgente")).toBe("🩺 Interesse: Hemograma");
  });

  it("retorna null quando nenhuma palavra-chave bate", () => {
    expect(detectProcedureInterestTag("Bom dia, tudo bem?")).toBeNull();
  });

  it("detecta a primeira palavra-chave da lista quando há mais de uma", () => {
    expect(detectProcedureInterestTag("consulta de cardiologia")).toBe("🩺 Interesse: Consulta");
  });
});

describe("detectSourceTag", () => {
  it("reconhece o texto pré-preenchido do link de /clinicas sem edição", () => {
    expect(detectSourceTag("Olá! Vi a Urolaser no Conecta Saúde e gostaria de consultar horários e exames disponíveis.")).toBe(
      "📢 Origem: Marketplace"
    );
  });

  it("retorna null pra mensagem comum (sem link rastreável)", () => {
    expect(detectSourceTag("Oi, gostaria de agendar uma consulta")).toBeNull();
  });

  it("retorna null quando o paciente edita o texto pré-preenchido a ponto de remover o trecho reconhecível", () => {
    expect(detectSourceTag("Vi vocês no Instagram")).toBeNull();
  });
});
