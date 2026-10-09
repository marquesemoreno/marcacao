import { describe, expect, it } from "vitest";
import { attendantLoadLevel, countAwaitingReply } from "./attendant-load";

describe("countAwaitingReply", () => {
  it("conta só conversas em que o paciente falou por último", () => {
    expect(countAwaitingReply(["INBOUND", "OUTBOUND", "INBOUND", null])).toBe(2);
  });
  it("lista vazia = 0", () => {
    expect(countAwaitingReply([])).toBe(0);
  });
});

describe("attendantLoadLevel", () => {
  it("até 5 aguardando é normal", () => {
    expect(attendantLoadLevel(0)).toBe("ok");
    expect(attendantLoadLevel(5)).toBe("ok");
  });
  it("6–7 aguardando = movimentado", () => {
    expect(attendantLoadLevel(6)).toBe("busy");
    expect(attendantLoadLevel(7)).toBe("busy");
  });
  it("8 ou mais = alerta (mas nunca bloqueia)", () => {
    expect(attendantLoadLevel(8)).toBe("high");
    expect(attendantLoadLevel(20)).toBe("high");
  });
});
