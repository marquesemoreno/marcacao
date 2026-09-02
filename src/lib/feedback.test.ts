import { describe, it, expect } from "vitest";
import { buildFeedbackMessage } from "./feedback";

describe("buildFeedbackMessage", () => {
  it("monta a mensagem de um bug com clínica e atendente", () => {
    const result = buildFeedbackMessage({
      type: "BUG",
      description: "O botão de enviar áudio não aparece no celular.",
      clinicName: "Urolaser",
      userName: "Bruna",
    });

    expect(result).toBe(
      "🐛 *Bug reportado*\nClínica: Urolaser\nAtendente: Bruna\n\nO botão de enviar áudio não aparece no celular."
    );
  });

  it("monta a mensagem de uma sugestão com rótulo diferente do bug", () => {
    const result = buildFeedbackMessage({
      type: "SUGGESTION",
      description: "Seria bom ter um atalho de teclado pra enviar mensagem.",
      clinicName: "Santa Clara",
      userName: "Ana",
    });

    expect(result).toBe(
      "💡 *Sugestão*\nClínica: Santa Clara\nAtendente: Ana\n\nSeria bom ter um atalho de teclado pra enviar mensagem."
    );
  });
});
