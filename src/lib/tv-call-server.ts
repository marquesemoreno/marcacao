import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPatientToken } from "@/lib/patient-token";
import { notifyTvCall } from "@/lib/realtime-server";
import { doctorKey, resolveRoom, tvDisplayName, tvSpokenName, type TvCall } from "@/lib/tv-call";

const HISTORY_HOURS = 24;

export async function doctorRoomsMap(clinicId: string): Promise<Map<string, string>> {
  const rows = await prisma.doctorRoom.findMany({ where: { clinicId }, select: { doctorKey: true, room: true } });
  return new Map(rows.map((r) => [r.doctorKey, r.room]));
}

/** Grava a chamada e avisa a TV. Mesma consulta chamada de novo em até 24 h = "rechamada"
 * (attempt + 1). Quem chama já checou a permissão "chamar". */
export async function createPatientCall(
  clinicId: string,
  userId: string,
  input: { source: string; externalId: string; patientName: string; doctor: string | null; room?: string | null; ticketCode?: string | null },
): Promise<TvCall> {
  const since = new Date(Date.now() - HISTORY_HOURS * 3600_000);
  // Limpeza preguiçosa: o histórico só vale pro dia.
  await prisma.patientCall.deleteMany({ where: { clinicId, createdAt: { lt: since } } }).catch(() => {});
  const previous = await prisma.patientCall.count({ where: { clinicId, source: input.source, externalId: input.externalId, createdAt: { gte: since } } });
  const room = resolveRoom(await doctorRoomsMap(clinicId), input.doctor, input.room ?? null);
  const row = await prisma.patientCall.create({
    data: {
      clinicId,
      source: input.source,
      externalId: input.externalId,
      displayName: input.ticketCode ?? tvDisplayName(input.patientName),
      spokenName: tvSpokenName(input.patientName),
      doctor: input.doctor?.trim() || null,
      room,
      attempt: previous + 1,
      calledByUserId: userId,
      ticketCode: input.ticketCode ?? null,
    },
  });
  await notifyTvCall(clinicId, row.id);
  return toTvCall(row);
}

export function toTvCall(row: { id: string; displayName: string; spokenName: string; doctor: string | null; room: string | null; createdAt: Date; attempt: number; ticketCode?: string | null }): TvCall {
  return {
    id: row.id,
    displayName: row.displayName,
    spokenName: row.spokenName,
    doctor: row.doctor,
    room: row.room,
    calledAt: row.createdAt.toISOString(),
    attempt: row.attempt,
    ticketCode: row.ticketCode ?? null,
  };
}

export async function recentCalls(clinicId: string, take = 6): Promise<TvCall[]> {
  const rows = await prisma.patientCall.findMany({
    where: { clinicId, createdAt: { gte: new Date(Date.now() - HISTORY_HOURS * 3600_000) } },
    orderBy: { createdAt: "desc" },
    take,
  });
  return rows.map(toTvCall);
}

/** Link novo da TV: devolve o token cru (só aparece uma vez). */
export async function issueTvDisplay(clinicId: string, name: string, kind: "TV" | "TOTEM" | "QR" = "TV"): Promise<{ id: string; raw: string }> {
  const raw = randomBytes(24).toString("base64url");
  const row = await prisma.tvDisplay.create({ data: { clinicId, name: name.trim() || (kind === "TOTEM" ? "Totem de senhas" : kind === "QR" ? "QR Code da recepção" : "TV da recepção"), kind, tokenHash: hashPatientToken(raw) } });
  return { id: row.id, raw };
}

/** TV pelo token (null = link inválido ou revogado). Marca "visto agora" no máximo 1×/min. */
export async function resolveTvDisplay(raw: string) {
  if (!/^[A-Za-z0-9_-]{20,100}$/.test(raw)) return null;
  const tv = await prisma.tvDisplay.findUnique({ where: { tokenHash: hashPatientToken(raw) } });
  if (!tv || tv.revokedAt) return null;
  if (!tv.lastSeenAt || Date.now() - tv.lastSeenAt.getTime() > 60_000) {
    await prisma.tvDisplay.update({ where: { id: tv.id }, data: { lastSeenAt: new Date() } }).catch(() => {});
  }
  return tv;
}

export { doctorKey };
