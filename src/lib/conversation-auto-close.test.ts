import { describe, expect, it } from "vitest";
import { decideAutoClose } from "./conversation-auto-close";

const now = new Date("2026-10-08T14:00:00Z");
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000);
const base = { now, lastDirection: "OUTBOUND" as const, pinned: false, inWindow: true, paused: false };

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
  it("entre 24h e 48h, avisa o paciente e fecha", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25) })).toBe("notify_and_close");
  });
  it("fora do horário 08–18h espera pra poder avisar", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), inWindow: false })).toBe("skip");
  });
  it("clínica com envios automáticos pausados fecha sem avisar", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(25), paused: true })).toBe("close_silent");
  });
  it("conversa antiga (mais de 48h) fecha sem avisar — não dispara aviso em massa no acumulado", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(49) })).toBe("close_silent");
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(49), inWindow: false })).toBe("close_silent");
  });
  it("conversa sem mensagem nenhuma fica como está", () => {
    expect(decideAutoClose({ ...base, lastMessageAt: hoursAgo(30), lastDirection: null })).toBe("skip");
  });
});
