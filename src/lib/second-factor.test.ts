import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ user: { updateMany: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { consumeSecondFactor } from "./second-factor";
import { generateTotpSecret, totpAt } from "./totp";
import { generateRecoveryCodes, hashRecoveryCode, isRecoveryCodeFormat } from "./recovery-codes";

const NOW = 1_763_380_800_000; // 2025-11-17T12:00:00Z, múltiplo de 30 s
const STEP = NOW / 30_000;
const secret = generateTotpSecret();

describe("consumeSecondFactor (auditoria B3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.user.updateMany.mockResolvedValue({ count: 1 });
  });

  it("aceita o código atual e grava o passo", async () => {
    const user = { id: "u1", totpSecret: secret, totpLastStep: null, totpRecoveryCodes: [] };
    expect(await consumeSecondFactor(user, totpAt(secret, NOW), NOW)).toBe("TOTP");
    expect(db.user.updateMany.mock.calls[0][0].data).toEqual({ totpLastStep: STEP });
  });

  it("o mesmo código (mesmo passo) não vale de novo", async () => {
    const user = { id: "u1", totpSecret: secret, totpLastStep: STEP, totpRecoveryCodes: [] };
    expect(await consumeSecondFactor(user, totpAt(secret, NOW), NOW + 20_000)).toBeNull();
    expect(db.user.updateMany).not.toHaveBeenCalled();
  });

  it("código anterior ao último aceito também não vale", async () => {
    const user = { id: "u1", totpSecret: secret, totpLastStep: STEP, totpRecoveryCodes: [] };
    expect(await consumeSecondFactor(user, totpAt(secret, NOW - 30_000), NOW)).toBeNull();
  });

  it("o código seguinte vale", async () => {
    const user = { id: "u1", totpSecret: secret, totpLastStep: STEP, totpRecoveryCodes: [] };
    expect(await consumeSecondFactor(user, totpAt(secret, NOW + 30_000), NOW + 30_000)).toBe("TOTP");
  });

  it("corrida: se outro login gravou o passo antes, recusa", async () => {
    db.user.updateMany.mockResolvedValue({ count: 0 });
    const user = { id: "u1", totpSecret: secret, totpLastStep: null, totpRecoveryCodes: [] };
    expect(await consumeSecondFactor(user, totpAt(secret, NOW), NOW)).toBeNull();
  });

  it("código de reserva vale uma vez e sai da lista", async () => {
    const { codes, hashes } = generateRecoveryCodes(3);
    const user = { id: "u1", totpSecret: secret, totpLastStep: null, totpRecoveryCodes: hashes };
    expect(await consumeSecondFactor(user, codes[1].toUpperCase(), NOW)).toBe("RECOVERY");
    expect(db.user.updateMany.mock.calls[0][0].data).toEqual({ totpRecoveryCodes: { set: [hashes[0], hashes[2]] } });
  });

  it("código de reserva desconhecido não vale", async () => {
    const user = { id: "u1", totpSecret: secret, totpLastStep: null, totpRecoveryCodes: [hashRecoveryCode("abcd-efgh")] };
    expect(await consumeSecondFactor(user, "zzzz-zzzz", NOW)).toBeNull();
  });
});

describe("códigos de reserva", () => {
  it("formato abcd-efgh, todos diferentes, aceitos sem hífen e em maiúscula", () => {
    const { codes } = generateRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(isRecoveryCodeFormat(codes[0].replace("-", "").toUpperCase())).toBe(true);
    expect(hashRecoveryCode(codes[0])).toBe(hashRecoveryCode(codes[0].replace("-", " ").toUpperCase()));
    expect(isRecoveryCodeFormat("123456")).toBe(false);
  });
});
