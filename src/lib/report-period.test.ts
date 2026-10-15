import { describe, expect, it } from "vitest";
import { reportWindow, compareDelta, periodWindow, parsePeriodKey, periodLabels } from "./report-period";

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

describe("periodWindow (mês-calendário, Brasília)", () => {
  const n = new Date("2026-10-15T15:00:00Z");
  it("este mês: desde 1º/10 00h de Brasília, sem fim; comparação = setembro inteiro", () => {
    expect(periodWindow("mes", false, n)).toEqual({ since: new Date("2026-10-01T03:00:00Z"), until: null });
    expect(periodWindow("mes", true, n)).toEqual({ since: new Date("2026-09-01T03:00:00Z"), until: new Date("2026-10-01T03:00:00Z") });
  });
  it("mês passado: setembro inteiro; comparação = agosto", () => {
    expect(periodWindow("mes-anterior", false, n)).toEqual({ since: new Date("2026-09-01T03:00:00Z"), until: new Date("2026-10-01T03:00:00Z") });
    expect(periodWindow("mes-anterior", true, n).since).toEqual(new Date("2026-08-01T03:00:00Z"));
  });
  it("virada de ano e 1º dia do mês antes das 03h UTC ainda é o mês anterior em Brasília", () => {
    expect(periodWindow("mes-anterior", false, new Date("2027-01-10T12:00:00Z")).since).toEqual(new Date("2026-12-01T03:00:00Z"));
    expect(periodWindow("mes", false, new Date("2026-11-01T02:00:00Z")).since).toEqual(new Date("2026-10-01T03:00:00Z"));
  });
  it("janelas móveis continuam iguais", () => {
    expect(periodWindow("7", false, now)).toEqual(reportWindow(7, false, now));
  });
});

describe("parsePeriodKey / periodLabels", () => {
  it("aceita periodo novo, days antigo e cai em 30", () => {
    expect(parsePeriodKey("mes")).toBe("mes");
    expect(parsePeriodKey(undefined, "7")).toBe("7");
    expect(parsePeriodKey("abc")).toBe("30");
  });
  it("rótulos", () => {
    const n = new Date("2026-10-15T15:00:00Z");
    expect(periodLabels("mes-anterior", n)).toMatchObject({ title: "setembro", compare: "agosto" });
    expect(periodLabels("30", n).compare).toBe("30 dias anteriores");
  });
});
