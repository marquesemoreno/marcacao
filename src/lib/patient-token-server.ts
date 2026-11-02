import "server-only";
import { prisma } from "@/lib/prisma";
import { hashPatientToken, newPatientToken, patientTokenState, type PatientTokenKind } from "@/lib/patient-token";

type AppointmentRef = { source: "BRIDGE" | "LOCAL"; externalId: string; date: string };

/** Cria um link do paciente e devolve o token cru (só pra ir na mensagem — não é gravado). */
export async function issuePatientToken(input: {
  clinicId: string;
  kind: PatientTokenKind;
  phone?: string | null;
  contactId?: string | null;
  appointment?: AppointmentRef;
}): Promise<{ raw: string; id: string; expiresAt: Date }> {
  const t = newPatientToken(input.kind);
  const row = await prisma.patientToken.create({
    data: {
      clinicId: input.clinicId,
      kind: input.kind,
      tokenHash: t.tokenHash,
      phone: input.phone ?? null,
      contactId: input.contactId ?? null,
      appointmentSource: input.appointment?.source ?? null,
      appointmentExternalId: input.appointment?.externalId ?? null,
      appointmentDate: input.appointment ? new Date(`${input.appointment.date}T00:00:00Z`) : null,
      expiresAt: t.expiresAt,
    },
    select: { id: true, expiresAt: true },
  });
  return { raw: t.raw, id: row.id, expiresAt: row.expiresAt };
}

/** Acha o link pelo token cru e diz se ainda vale. O tipo precisa bater (link de NPS não
 * abre a ficha). */
export async function resolvePatientToken(raw: string, kind: PatientTokenKind) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(raw)) return { state: "NOT_FOUND" as const, token: null };
  const token = await prisma.patientToken.findUnique({ where: { tokenHash: hashPatientToken(raw) } });
  if (!token || token.kind !== kind) return { state: "NOT_FOUND" as const, token: null };
  return { state: patientTokenState(token), token };
}

/** Marca como usado de forma atômica — dois envios simultâneos: só um ganha. */
export async function consumePatientToken(id: string): Promise<boolean> {
  const { count } = await prisma.patientToken.updateMany({
    where: { id, usedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  });
  return count === 1;
}

/** Revoga os links ainda abertos de uma consulta (cancelou/remarcou). */
export async function revokePatientTokens(clinicId: string, appointment: Omit<AppointmentRef, "date">): Promise<number> {
  const { count } = await prisma.patientToken.updateMany({
    where: { clinicId, appointmentSource: appointment.source, appointmentExternalId: appointment.externalId, usedAt: null, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}
