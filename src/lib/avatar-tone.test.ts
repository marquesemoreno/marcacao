import { describe, expect, it } from "vitest";
import { AVATAR_TONES, avatarTone } from "./avatar-tone";

describe("avatarTone", () => {
  it("sempre devolve a mesma cor para o mesmo paciente", () => {
    expect(avatarTone("conv-123")).toBe(avatarTone("conv-123"));
  });

  it("devolve uma das cores da paleta", () => {
    for (const seed of ["a", "b", "Helena Prado", "cmw9j9fpz00ddl09jxtjgxg89", ""]) {
      expect(AVATAR_TONES).toContain(avatarTone(seed));
    }
  });

  it("espalha os pacientes por várias cores (não fica tudo igual)", () => {
    const seeds = Array.from({ length: 40 }, (_, i) => `conversa-${i}`);
    const used = new Set(seeds.map(avatarTone));
    expect(used.size).toBeGreaterThanOrEqual(AVATAR_TONES.length - 1);
  });
});
