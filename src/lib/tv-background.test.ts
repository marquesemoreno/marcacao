import { describe, expect, it } from "vitest";
import { LANDSCAPES, landscapeIndexAt, parseTvBackground, LANDSCAPE_PERIOD_MIN } from "./tv-background";

describe("fundo do painel da TV", () => {
  it("valor desconhecido ou vazio vira Liso", () => {
    expect(parseTvBackground(undefined)).toBe("LISO");
    expect(parseTvBackground("XPTO")).toBe("LISO");
    expect(parseTvBackground("ARTE")).toBe("ARTE");
    expect(parseTvBackground("PAISAGENS")).toBe("PAISAGENS");
  });

  it("paisagens são fotos do Unsplash em 1920 px", () => {
    expect(LANDSCAPES.length).toBeGreaterThanOrEqual(8);
    for (const p of LANDSCAPES) expect(p.url).toMatch(/^https:\/\/images\.unsplash\.com\/photo-[\w-]+\?w=1920/);
  });

  it("troca de foto a cada período e dá a volta na lista", () => {
    const t0 = new Date("2026-11-09T12:00:00Z").getTime();
    const i0 = landscapeIndexAt(t0);
    expect(landscapeIndexAt(t0 + 60_000)).toBe(i0); // 1 min depois: mesma foto
    expect(landscapeIndexAt(t0 + LANDSCAPE_PERIOD_MIN * 60_000)).toBe((i0 + 1) % LANDSCAPES.length);
    expect(landscapeIndexAt(t0 + LANDSCAPES.length * LANDSCAPE_PERIOD_MIN * 60_000)).toBe(i0);
  });
});
