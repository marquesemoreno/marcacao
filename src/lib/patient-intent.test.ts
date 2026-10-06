import { describe, expect, it } from "vitest";
import { intentFromJevAnswer, visibleIntent, PATIENT_INTENT_MIN_CONFIDENCE } from "./patient-intent";

describe("intentFromJevAnswer", () => {
  it("aceita categoria conhecida e guarda a confiança", () => {
    expect(intentFromJevAnswer({ type: "choice", choice: "REMARCAR", confidence: 0.93 })).toEqual({ intent: "REMARCAR", confidence: 0.93 });
  });
  it("categoria desconhecida ou resposta vazia é null", () => {
    expect(intentFromJevAnswer({ type: "choice", choice: "XYZ", confidence: 1 })).toBeNull();
    expect(intentFromJevAnswer(undefined)).toBeNull();
  });
});

describe("visibleIntent", () => {
  it("só mostra com confiança alta e categoria útil", () => {
    expect(visibleIntent("PRECO", PATIENT_INTENT_MIN_CONFIDENCE)).toBe("PRECO");
    expect(visibleIntent("PRECO", 0.6)).toBeNull();
    expect(visibleIntent("SAUDACAO", 0.99)).toBeNull();
    expect(visibleIntent("DUVIDA", 0.99)).toBeNull();
    expect(visibleIntent(null, null)).toBeNull();
  });
});
