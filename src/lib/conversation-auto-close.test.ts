import { describe, expect, it } from "vitest";
import { decideAutoClose, endingFromJevAnswer } from "./conversation-auto-close";

const now = new Date("2026-10-08T14:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
const base = {
  now,
  lastDirection: "OUTBOUND" as const,
  pinned: false,
  inWindow: true,
  paused: false,
  ending: "AWAITING" as const,
};

describe("decideAutoClose", () => {
  it("não mexe em conversa com mensagem nas últimas 24h", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(23) })).toBe("skip");
  });
  it("não fecha quando o paciente ficou sem resposta (última mensagem é dele)", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(30), lastDirection: "INBOUND" })).toBe("skip");
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(100), lastDirection: "INBOUND" })).toBe("skip");
  });
  it("não fecha conversa fixada", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(30), pinned: true })).toBe("skip");
  });
  it("esperando o paciente, entre 24h e 48h: avisa e fecha como inatividade", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25) })).toBe("notify_and_close");
  });
  it("fora do horário 08–18h espera pra poder avisar", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), inWindow: false })).toBe("skip");
  });
  it("clínica com envios automáticos pausados fecha sem avisar", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), paused: true })).toBe("close_inactive");
  });
  it("conversa antiga (mais de 48h) esperando o paciente fecha sem avisar", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(49) })).toBe("close_inactive");
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(49), inWindow: false })).toBe("close_inactive");
  });
  it("conversa que terminou naturalmente fecha como concluída, sem aviso", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), ending: "CONCLUDED" })).toBe("close_concluded");
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), ending: "CONCLUDED", inWindow: false })).toBe("close_concluded");
  });
  it("na dúvida, fecha sem aviso", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), ending: "UNSURE" })).toBe("close_inactive");
  });
  it("conversa sem mensagem nenhuma fica como está", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(30), lastDirection: null })).toBe("skip");
  });
});

describe("endingFromJevAnswer", () => {
  it("aceita só com confiança alta", () => {
    expect(endingFromJevAnswer({ type: "choice", choice: "CONCLUDED", confidence: 0.9 })).toBe("CONCLUDED");
    expect(endingFromJevAnswer({ type: "choice", choice: "AWAITING", confidence: 0.95 })).toBe("AWAITING");
    expect(endingFromJevAnswer({ type: "choice", choice: "AWAITING", confidence: 0.6 })).toBe("UNSURE");
  });
  it("Jev indisponível ou resposta estranha = dúvida", () => {
    expect(endingFromJevAnswer(undefined)).toBe("UNSURE");
    expect(endingFromJevAnswer({ type: "choice", choice: "XYZ", confidence: 1 })).toBe("UNSURE");
  });
});
