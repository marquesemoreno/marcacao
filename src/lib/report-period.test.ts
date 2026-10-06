import { describe, expect, it } from "vitest";
import { reportWindow, compareDelta } from "./report-period";

const now = new Date("2026-10-06T15:00:00Z");

describe("reportWindow", () => {
  it("período atual: desde o início do dia N dias atrás, sem fim", () => {
    const w = reportWindow(7, false, now);
    expect(w.since.toISOString()).toBe("2026-09-29T00:00:00.000Z");
    expect(w.until).toBeNull();
  });
  it("período anterior: a janela de mesmo tamanho logo antes", () => {
    const w = reportWindow(7, true, now);
    expect(w.since.toISOString()).toBe("2026-09-22T00:00:00.000Z");
    expect(w.until?.toISOString()).toBe("2026-09-29T00:00:00.000Z");
  });
});

describe("compareDelta", () => {
  it("pontos percentuais com direção e se é bom", () => {
    expect(compareDelta(72, 64, "pts", "up")).toEqual({ text: "↑ 8 pts", good: true });
    expect(compareDelta(60, 64, "pts", "up")).toEqual({ text: "↓ 4 pts", good: false });
  });
  it("quando menor é melhor (tempo de resposta)", () => {
    expect(compareDelta(20, 30, "%", "down")).toEqual({ text: "↓ 33%", good: true });
  });
  it("sem base anterior ou igual", () => {
    expect(compareDelta(10, null, "%", "up")).toBeNull();
    expect(compareDelta(5, 0, "%", "up")).toBeNull();
    expect(compareDelta(50, 50, "pts", "up")).toEqual({ text: "= igual", good: null });
  });
});
