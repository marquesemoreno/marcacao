import { describe, expect, it } from "vitest";
import { npsSummary, npsBucket, parseNpsScore } from "./nps";

describe("npsBucket", () => {
  it("0–6 detrator, 7–8 neutro, 9–10 promotor", () => {
    expect(npsBucket(0)).toBe("DETRACTOR");
    expect(npsBucket(6)).toBe("DETRACTOR");
    expect(npsBucket(7)).toBe("PASSIVE");
    expect(npsBucket(8)).toBe("PASSIVE");
    expect(npsBucket(9)).toBe("PROMOTER");
    expect(npsBucket(10)).toBe("PROMOTER");
  });
});

describe("npsSummary", () => {
  it("sem respostas → nps null", () => {
    expect(npsSummary([])).toEqual({ total: 0, promoters: 0, passives: 0, detractors: 0, nps: null });
  });
  it("% promotores − % detratores, arredondado", () => {
    // 3 promotores, 1 neutro, 2 detratores → 50% − 33,3% = 16,7 → 17
    expect(npsSummary([10, 9, 9, 7, 3, 0])).toEqual({ total: 6, promoters: 3, passives: 1, detractors: 2, nps: 17 });
  });
  it("todos detratores → −100", () => {
    expect(npsSummary([1, 2]).nps).toBe(-100);
  });
});

describe("parseNpsScore", () => {
  it("aceita inteiro 0–10 (número ou texto)", () => {
    expect(parseNpsScore(0)).toBe(0);
    expect(parseNpsScore("10")).toBe(10);
  });
  it("recusa fora da faixa, fração ou lixo", () => {
    expect(parseNpsScore(11)).toBeNull();
    expect(parseNpsScore(-1)).toBeNull();
    expect(parseNpsScore(7.5)).toBeNull();
    expect(parseNpsScore("abc")).toBeNull();
    expect(parseNpsScore(null)).toBeNull();
  });
});
