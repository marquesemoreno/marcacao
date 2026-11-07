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
import { describe as d2, expect as e2, it as i2 } from "vitest";
import { normalizeReviewUrl, reviewLinkFor } from "./nps";

d2("link de avaliação no Google (4.4)", () => {
  i2("só promotores (9–10) recebem o link", () => {
    e2(reviewLinkFor(9, "https://g.page/r/abc/review")).toBe("https://g.page/r/abc/review");
    e2(reviewLinkFor(10, "https://g.page/r/abc/review")).toBe("https://g.page/r/abc/review");
    e2(reviewLinkFor(8, "https://g.page/r/abc/review")).toBeNull();
    e2(reviewLinkFor(10, null)).toBeNull();
  });
  i2("aceita só https; completa quem colou sem protocolo", () => {
    e2(normalizeReviewUrl("  g.page/r/abc/review ")).toBe("https://g.page/r/abc/review");
    e2(normalizeReviewUrl("https://search.google.com/local/writereview?placeid=X")).toBe("https://search.google.com/local/writereview?placeid=X");
    e2(normalizeReviewUrl("")).toBeNull();
    e2(normalizeReviewUrl("javascript:alert(1)")).toBeNull();
    e2(normalizeReviewUrl("http://g.page/x")).toBe("https://g.page/x");
    e2(normalizeReviewUrl("não é link")).toBeNull();
  });
});
