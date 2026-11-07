import { describe, expect, it } from "vitest";
import { DEFAULT_CLOSING_MESSAGE, shouldSendClosingMessage } from "./closing-message";

const now = new Date("2026-11-07T15:00:00Z");
const base = {
  enabled: true,
  text: DEFAULT_CLOSING_MESSAGE,
  requested: true,
  reason: "DUVIDA_ESCLARECIDA",
  lastInboundAt: new Date("2026-11-07T14:50:00Z"),
  recentOutbound: [] as { content: string; createdAt: Date }[],
  now,
};

describe("shouldSendClosingMessage", () => {
  it("envia quando ligado, pedido e dentro da janela", () => {
    expect(shouldSendClosingMessage(base)).toBe(true);
  });

  it("não envia com a opção desligada ou texto vazio", () => {
    expect(shouldSendClosingMessage({ ...base, enabled: false })).toBe(false);
    expect(shouldSendClosingMessage({ ...base, text: "   " })).toBe(false);
  });

  it("não envia quando a atendente desmarcou no modal", () => {
    expect(shouldSendClosingMessage({ ...base, requested: false })).toBe(false);
  });

  it("não envia em motivos em que o paciente não está na conversa", () => {
    for (const reason of ["SEM_RESPOSTA", "INATIVIDADE", "ATENDIMENTO_CONCLUIDO", "ADMINISTRATIVO", "ATENDIDO_NO_CELULAR", "ENCAMINHADO"]) {
      expect(shouldSendClosingMessage({ ...base, reason })).toBe(false);
    }
  });

  it("não envia fora da janela de 24 h ou sem mensagem do paciente", () => {
    expect(shouldSendClosingMessage({ ...base, lastInboundAt: new Date("2026-11-06T14:59:00Z") })).toBe(false);
    expect(shouldSendClosingMessage({ ...base, lastInboundAt: null })).toBe(false);
  });

  it("não repete se a despedida já foi mandada há pouco (texto parecido)", () => {
    const recentOutbound = [
      { content: "espero ter resolvido sua solicitação! caso surja outra dúvida, é só chamar", createdAt: new Date("2026-11-07T14:55:00Z") },
    ];
    expect(shouldSendClosingMessage({ ...base, recentOutbound })).toBe(false);
  });

  it("envia se a despedida parecida é antiga (mais de 30 min)", () => {
    const recentOutbound = [{ content: DEFAULT_CLOSING_MESSAGE, createdAt: new Date("2026-11-07T14:00:00Z") }];
    expect(shouldSendClosingMessage({ ...base, recentOutbound })).toBe(true);
  });

  it("outras mensagens recentes não bloqueiam", () => {
    const recentOutbound = [{ content: "Sua consulta ficou para terça às 15h.", createdAt: new Date("2026-11-07T14:58:00Z") }];
    expect(shouldSendClosingMessage({ ...base, recentOutbound })).toBe(true);
  });
});
