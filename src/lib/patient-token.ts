import { createHash, randomBytes } from "crypto";

/** Links de uso do paciente (ficha prévia, check-in, NPS) enviados pelo WhatsApp.
 * O token cru só existe na mensagem; no banco fica o SHA-256 (vazar o banco não vaza
 * links válidos). Puro — sem banco. */
export type PatientTokenKind = "ANAMNESE" | "CHECKIN" | "NPS";

export const PATIENT_TOKEN_TTL_HOURS: Record<PatientTokenKind, number> = {
  ANAMNESE: 72, // enviado na véspera, vale até o dia seguinte à consulta
  CHECKIN: 36,
  NPS: 7 * 24,
};

export function hashPatientToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function newPatientToken(kind: PatientTokenKind, now: Date = new Date()) {
  const raw = randomBytes(32).toString("base64url");
  return {
    raw,
    tokenHash: hashPatientToken(raw),
    expiresAt: new Date(now.getTime() + PATIENT_TOKEN_TTL_HOURS[kind] * 3_600_000),
  };
}

export type PatientTokenState = "VALID" | "EXPIRED" | "USED" | "REVOKED" | "NOT_FOUND";

export function patientTokenState(
  t: { expiresAt: Date; usedAt: Date | null; revokedAt: Date | null } | null,
  now: Date = new Date()
): PatientTokenState {
  if (!t) return "NOT_FOUND";
  if (t.revokedAt) return "REVOKED";
  if (t.usedAt) return "USED";
  if (now.getTime() > t.expiresAt.getTime()) return "EXPIRED";
  return "VALID";
}
