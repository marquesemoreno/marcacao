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

import { isIpLocked, LOGIN_MAX_FAILURES_PER_IP } from "./login-guard";

describe("isIpLocked (auditoria 16/11/2026, M10)", () => {
  it("bloqueia a origem com 20 erros na janela, qualquer que seja o e-mail", () => {
    expect(isIpLocked(LOGIN_MAX_FAILURES_PER_IP)).toBe(true);
    expect(isIpLocked(LOGIN_MAX_FAILURES_PER_IP + 5)).toBe(true);
  });
  it("uma recepção inteira errando a senha no mesmo Wi-Fi não bloqueia", () => {
    expect(isIpLocked(LOGIN_MAX_FAILURES_PER_IP - 1)).toBe(false);
    expect(LOGIN_MAX_FAILURES_PER_IP).toBeGreaterThanOrEqual(15);
  });
});
