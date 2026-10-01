import { describe, it, expect } from "vitest";
import { levenshteinSimilarity, tierFor } from "./levenshtein";

describe("levenshteinSimilarity", () => {
  it("é 1 pra strings idênticas (case/trim insensitive)", () => {
    expect(levenshteinSimilarity("Colonoscopia", "colonoscopia")).toBe(1);
    expect(levenshteinSimilarity("  USG Abdome Total  ", "usg abdome total")).toBe(1);
  });

  it("fica acima do limiar de 80% pra ruído de OCR típico (1-2 letras erradas)", () => {
    // Nomes reais de procedimento desta clínica (ver procedure-name.test.ts), com
    // o tipo de erro que uma OCR comete de verdade: acento sumido, letra trocada.
    expect(levenshteinSimilarity("Urodinamica Completa", "Urodinâmica Completa")).toBeGreaterThanOrEqual(0.8);
    expect(levenshteinSimilarity("Colonoscopla", "Colonoscopia")).toBeGreaterThanOrEqual(0.8);
  });

  it("fica abaixo do limiar de 80% pra procedimento claramente diferente", () => {
    expect(levenshteinSimilarity("Consulta Urologia", "Exérese de Lesão de Pele")).toBeLessThan(0.8);
  });

  it("não lança com string vazia", () => {
    expect(levenshteinSimilarity("", "")).toBe(1);
    expect(levenshteinSimilarity("Consulta", "")).toBe(0);
  });
});

describe("tierFor", () => {
  it("classifica Alta Confiança a partir de 85", () => {
    expect(tierFor(85)).toBe("ALTA");
    expect(tierFor(100)).toBe("ALTA");
  });

  it("classifica Revisão Necessária entre 60 e 84", () => {
    expect(tierFor(60)).toBe("REVISAO");
    expect(tierFor(84)).toBe("REVISAO");
  });

  it("classifica Baixa Confiança abaixo de 60", () => {
    expect(tierFor(59)).toBe("BAIXA");
    expect(tierFor(0)).toBe("BAIXA");
  });
});
