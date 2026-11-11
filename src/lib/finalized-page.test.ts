import { describe, expect, it } from "vitest";
import { FINALIZED_MAX, FINALIZED_PAGE_SIZE, finalizedTake, hasMoreFinalized, nextFinalizedLimit } from "./finalized-page";

describe("finalizedTake", () => {
  it("sem limite pedido, devolve uma página", () => {
    expect(finalizedTake()).toBe(FINALIZED_PAGE_SIZE);
    expect(finalizedTake(undefined)).toBe(FINALIZED_PAGE_SIZE);
  });

  it("respeita o limite pedido pelo Carregar mais", () => {
    expect(finalizedTake(400)).toBe(400);
  });

  it("nunca aceita valor inválido nem passa do teto (o parâmetro vem do navegador)", () => {
    expect(finalizedTake(0)).toBe(FINALIZED_PAGE_SIZE);
    expect(finalizedTake(-5)).toBe(FINALIZED_PAGE_SIZE);
    expect(finalizedTake(Number.NaN)).toBe(FINALIZED_PAGE_SIZE);
    expect(finalizedTake(10.7)).toBe(10);
    expect(finalizedTake(999_999)).toBe(FINALIZED_MAX);
  });
});

describe("hasMoreFinalized", () => {
  it("lista cheia até o limite indica que pode haver mais", () => {
    expect(hasMoreFinalized(200, 200)).toBe(true);
    expect(hasMoreFinalized(199, 200)).toBe(false);
  });

  it("no teto não oferece mais", () => {
    expect(hasMoreFinalized(FINALIZED_MAX, FINALIZED_MAX)).toBe(false);
  });
});

describe("nextFinalizedLimit", () => {
  it("soma uma página, sem passar do teto", () => {
    expect(nextFinalizedLimit(200)).toBe(400);
    expect(nextFinalizedLimit(FINALIZED_MAX - 50)).toBe(FINALIZED_MAX);
  });
});
