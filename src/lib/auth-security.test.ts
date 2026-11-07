import { describe, expect, it } from "vitest";
import {
  hashResetToken,
  newResetToken,
  passwordProblem,
  RESET_TOKEN_TTL_MS,
  resetTokenStatus,
  sessionStillValid,
  requiresTwoFactor,
} from "./auth-security";

describe("token de redefinição de senha", () => {
  it("token aleatório, guarda só o hash, vale 1 hora", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const t = newResetToken(now);
    expect(t.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(t.hash).toBe(hashResetToken(t.token));
    expect(t.hash).not.toContain(t.token);
    expect(t.expiresAt.getTime() - now.getTime()).toBe(RESET_TOKEN_TTL_MS);
  });

  it("status: válido, vencido, já usado, inexistente", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    const later = new Date("2026-11-07T12:30:00Z");
    expect(resetTokenStatus({ expiresAt: later, usedAt: null }, now)).toBe("ok");
    expect(resetTokenStatus({ expiresAt: now, usedAt: null }, later)).toBe("expired");
    expect(resetTokenStatus({ expiresAt: later, usedAt: now }, now)).toBe("used");
    expect(resetTokenStatus(null, now)).toBe("invalid");
  });
});

describe("senha nova", () => {
  it("mínimo 8 caracteres com letra e número", () => {
    expect(passwordProblem("abc123")).toMatch(/8/);
    expect(passwordProblem("abcdefgh")).toMatch(/número/);
    expect(passwordProblem("12345678")).toMatch(/letra/);
    expect(passwordProblem("clinica2026")).toBeNull();
  });
});

describe("sessão", () => {
  it("cai se o usuário foi desativado ou a versão mudou (troca de senha / encerrar sessões)", () => {
    expect(sessionStillValid(0, { active: true, sessionVersion: 0 })).toBe(true);
    expect(sessionStillValid(0, { active: true, sessionVersion: 1 })).toBe(false);
    expect(sessionStillValid(0, { active: false, sessionVersion: 0 })).toBe(false);
    expect(sessionStillValid(0, null)).toBe(false);
    // JWT emitido antes desta mudança não tem versão: vale como 0.
    expect(sessionStillValid(undefined, { active: true, sessionVersion: 0 })).toBe(true);
  });

  it("2FA só para quem ativou", () => {
    expect(requiresTwoFactor({ totpSecret: "enc", totpEnabledAt: new Date() })).toBe(true);
    expect(requiresTwoFactor({ totpSecret: "enc", totpEnabledAt: null })).toBe(false);
    expect(requiresTwoFactor({ totpSecret: null, totpEnabledAt: null })).toBe(false);
  });
});
