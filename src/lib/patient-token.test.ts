import { describe, expect, it } from "vitest";
import { PATIENT_TOKEN_TTL_HOURS, hashPatientToken, newPatientToken, patientTokenState } from "./patient-token";

const now = new Date("2026-11-02T12:00:00Z");

describe("newPatientToken", () => {
  it("gera token aleatório longo, só o hash vai pro banco", () => {
    const a = newPatientToken("ANAMNESE", now);
    const b = newPatientToken("ANAMNESE", now);
    expect(a.raw).not.toBe(b.raw);
    expect(a.raw.length).toBeGreaterThanOrEqual(40);
    expect(a.raw).toMatch(/^[A-Za-z0-9_-]+$/); // cabe em URL sem escapar
    expect(a.tokenHash).toBe(hashPatientToken(a.raw));
    expect(a.tokenHash).not.toContain(a.raw);
  });
  it("validade por tipo", () => {
    const t = newPatientToken("CHECKIN", now);
    expect(t.expiresAt.getTime() - now.getTime()).toBe(PATIENT_TOKEN_TTL_HOURS.CHECKIN * 3_600_000);
  });
});

describe("patientTokenState", () => {
  const base = { expiresAt: new Date("2026-11-03T12:00:00Z"), usedAt: null, revokedAt: null };
  it("válido", () => expect(patientTokenState(base, now)).toBe("VALID"));
  it("vencido", () => expect(patientTokenState(base, new Date("2026-11-03T12:00:01Z"))).toBe("EXPIRED"));
  it("já usado", () => expect(patientTokenState({ ...base, usedAt: now }, now)).toBe("USED"));
  it("revogado ganha de tudo", () =>
    expect(patientTokenState({ ...base, usedAt: now, revokedAt: now }, now)).toBe("REVOKED"));
  it("token inexistente", () => expect(patientTokenState(null, now)).toBe("NOT_FOUND"));
});
