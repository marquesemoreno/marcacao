import { describe, expect, it } from "vitest";
import { isLoginLocked, LOGIN_MAX_FAILURES, SESSION_MAX_AGE_SEC } from "./login-guard";

const now = new Date("2026-10-20T12:00:00Z");
const ago = (min: number) => new Date(now.getTime() - min * 60_000);

describe("isLoginLocked", () => {
  it("bloqueia com 5 senhas erradas nos últimos 15 minutos", () => {
    expect(isLoginLocked(Array.from({ length: LOGIN_MAX_FAILURES }, (_, i) => ago(i)), now)).toBe(true);
  });
  it("não bloqueia com menos de 5, nem com falhas antigas", () => {
    expect(isLoginLocked([ago(1), ago(2), ago(3), ago(4)], now)).toBe(false);
    expect(isLoginLocked([ago(20), ago(21), ago(22), ago(23), ago(24)], now)).toBe(false);
  });
  it("sessão dura um turno (12 h)", () => {
    expect(SESSION_MAX_AGE_SEC).toBe(12 * 60 * 60);
  });
});
