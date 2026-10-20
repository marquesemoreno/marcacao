import { describe, expect, it } from "vitest";
import { ageFrom, isMinor } from "./minor";

const now = new Date("2026-10-21T12:00:00Z");

describe("isMinor", () => {
  it("menor de 18 pela data de nascimento", () => {
    expect(isMinor("2010-05-01", now)).toBe(true);
    expect(isMinor("2008-10-21", now)).toBe(false); // faz 18 hoje
    expect(isMinor("2008-10-22", now)).toBe(true); // faz 18 amanhã
  });
  it("sem data não é tratado como menor", () => {
    expect(isMinor(undefined, now)).toBe(false);
    expect(ageFrom("", now)).toBeNull();
  });
});
