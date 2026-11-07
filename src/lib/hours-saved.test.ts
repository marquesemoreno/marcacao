import { describe, expect, it } from "vitest";
import { classifyAutomaticMessage, summarizeHoursSaved, SECONDS_PER_MESSAGE } from "./hours-saved";

describe("classifyAutomaticMessage", () => {
  it("lembretes", () => {
    expect(classifyAutomaticMessage("Olá *Gilson Moura*! 👋 Lembrando da sua consulta")).toBe("lembrete");
    expect(classifyAutomaticMessage("Olá, *José*! Eu sou a Lara, atendente virtual")).toBe("lembrete");
  });
  it("respostas aos lembretes", () => {
    expect(classifyAutomaticMessage("Agradecemos a confirmação! 📍 Te esperamos")).toBe("resposta_lembrete");
    expect(classifyAutomaticMessage("Entendido! Nossa equipe vai entrar em contato")).toBe("resposta_lembrete");
    expect(classifyAutomaticMessage("Entendido, obrigado por avisar!")).toBe("resposta_lembrete");
  });
  it("aviso de encerramento, boas-vindas, endereço, confirmação, remarcação", () => {
    expect(classifyAutomaticMessage("Vamos finalizar este atendimento por aqui")).toBe("encerramento");
    expect(classifyAutomaticMessage("Olá! 👋 Seja bem-vindo(a) à Clínica")).toBe("boas_vindas");
    expect(classifyAutomaticMessage("Boa tarde, Maria! Seja bem-vinda")).toBe("boas_vindas");
    expect(classifyAutomaticMessage("📍 Nosso endereço: Av. X")).toBe("endereco");
    expect(classifyAutomaticMessage("✅ Agendamento confirmado, Maria!")).toBe("confirmacao");
    expect(classifyAutomaticMessage("Olá, Rita! Seu agendamento foi realizado")).toBe("confirmacao");
    expect(classifyAutomaticMessage("Olá, Rita! Seu agendamento foi remarcado")).toBe("remarcacao");
  });
  it("outras", () => {
    expect(classifyAutomaticMessage("qualquer coisa")).toBe("outras");
    expect(classifyAutomaticMessage(null)).toBe("outras");
  });
});

describe("summarizeHoursSaved", () => {
  it("soma por categoria a 45 s por mensagem, maior primeiro", () => {
    const r = summarizeHoursSaved([
      "Vamos finalizar este atendimento",
      ...Array(80).fill("Olá *A*! 👋 Lembrando"),
    ]);
    expect(SECONDS_PER_MESSAGE).toBe(45);
    expect(r.totalMessages).toBe(81);
    expect(r.totalHours).toBeCloseTo((81 * 45) / 3600, 5);
    expect(r.categories[0]).toMatchObject({ key: "lembrete", count: 80 });
    expect(r.categories[1]).toMatchObject({ key: "encerramento", count: 1 });
  });
  it("vazio", () => {
    expect(summarizeHoursSaved([])).toMatchObject({ totalMessages: 0, totalHours: 0, categories: [] });
  });
});
