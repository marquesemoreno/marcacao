import { describe, expect, it } from "vitest";
import { actionFromJevAnswer, JEV_MIN_CONFIDENCE } from "./jev";

describe("actionFromJevAnswer", () => {
  it("aceita a escolha com confiança alta", () => {
    expect(actionFromJevAnswer({ type: "choice", choice: "RESCHEDULE", confidence: 0.99 })).toBe("RESCHEDULE");
    expect(actionFromJevAnswer({ type: "choice", choice: "CONFIRMED", confidence: JEV_MIN_CONFIDENCE })).toBe("CONFIRMED");
  });
  it("confiança baixa vira UNCLEAR (vai pra recepção)", () => {
    expect(actionFromJevAnswer({ type: "choice", choice: "CONFIRMED", confidence: 0.5 })).toBe("UNCLEAR");
  });
  it("resposta inválida ou ausente é null (usa o fallback)", () => {
    expect(actionFromJevAnswer(undefined)).toBeNull();
    expect(actionFromJevAnswer({ type: "choice", choice: "OUTRA", confidence: 1 })).toBeNull();
  });
});
