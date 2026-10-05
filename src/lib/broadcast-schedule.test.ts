import { describe, it, expect } from "vitest";
import { isMarketingGapElapsed, isWithinMarketingWindow, startOfBrazilDay } from "./broadcast-schedule";

// 2026-10-05 = segunda; 2026-10-03 = sábado. Brasília = UTC-3.
const br = (iso: string) => new Date(`${iso}-03:00`);

describe("isWithinMarketingWindow", () => {
  it("segunda a sexta, das 09:00 às 17:00 (Brasília)", () => {
    expect(isWithinMarketingWindow(br("2026-10-05T09:00:00"))).toBe(true);
    expect(isWithinMarketingWindow(br("2026-10-05T16:59:00"))).toBe(true);
    expect(isWithinMarketingWindow(br("2026-10-09T12:00:00"))).toBe(true); // sexta
  });
  it("fora do horário ou no fim de semana", () => {
    expect(isWithinMarketingWindow(br("2026-10-05T08:59:00"))).toBe(false);
    expect(isWithinMarketingWindow(br("2026-10-05T17:00:00"))).toBe(false);
    expect(isWithinMarketingWindow(br("2026-10-05T23:20:00"))).toBe(false);
    expect(isWithinMarketingWindow(br("2026-10-03T10:00:00"))).toBe(false); // sábado
    expect(isWithinMarketingWindow(br("2026-10-04T10:00:00"))).toBe(false); // domingo
  });
});

describe("startOfBrazilDay", () => {
  it("meia-noite de Brasília do dia corrente", () => {
    expect(startOfBrazilDay(br("2026-10-05T01:30:00")).toISOString()).toBe("2026-10-05T03:00:00.000Z");
    expect(startOfBrazilDay(br("2026-10-05T23:30:00")).toISOString()).toBe("2026-10-05T03:00:00.000Z");
  });
});

describe("isMarketingGapElapsed", () => {
  const last = new Date("2026-10-05T13:00:00Z");
  const at = (min: number) => new Date(last.getTime() + min * 60_000);
  it("nunca antes de 4 min, sempre depois de 6 min", () => {
    expect(isMarketingGapElapsed(last, at(3.9), 0)).toBe(false);
    expect(isMarketingGapElapsed(last, at(4), 0)).toBe(true);
    expect(isMarketingGapElapsed(last, at(5.9), 0.99)).toBe(false);
    expect(isMarketingGapElapsed(last, at(6), 0.99)).toBe(true);
  });
  it("sem envio anterior, libera", () => {
    expect(isMarketingGapElapsed(null, at(0), 0.5)).toBe(true);
  });
});
