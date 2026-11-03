"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicPermission } from "@/lib/session";
import { tvTopicFor } from "@/lib/realtime-server";
import { createPatientCall, issueTvDisplay, recentCalls, resolveTvDisplay, toTvCall } from "@/lib/tv-call-server";
import { doctorKey, type TvCall } from "@/lib/tv-call";
import { getBaseUrl } from "@/lib/format";

/** Recepção/gestão chama um paciente na TV (o status "Em atendimento" é marcado à parte,
 * pelo setAgendaStatus de sempre). */
export async function callPatientOnTv(input: {
  source: "BRIDGE" | "LOCAL";
  externalId: string;
  patientName: string;
  doctor: string | null;
  room?: string | null;
}): Promise<TvCall> {
  const { clinicId, userId } = await requireClinicPermission("chamar");
  return createPatientCall(clinicId, userId, input);
}

/** Salas fixas + TVs da clínica (tela Configurações › TV da sala de espera). */
export async function getTvSettings() {
  const { clinicId } = await requireClinicManager();
  const [rooms, displays] = await Promise.all([
    prisma.doctorRoom.findMany({ where: { clinicId }, orderBy: { doctor: "asc" } }),
    prisma.tvDisplay.findMany({ where: { clinicId, revokedAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  return {
    rooms: rooms.map((r) => ({ doctor: r.doctor, room: r.room })),
    displays: displays.map((d) => ({ id: d.id, name: d.name, lastSeenAt: d.lastSeenAt?.toISOString() ?? null })),
  };
}

export async function saveDoctorRoom(input: { doctor: string; room: string }) {
  const { clinicId } = await requireClinicManager();
  const doctor = input.doctor.trim();
  const room = input.room.trim().slice(0, 40);
  if (!doctor) throw new Error("Escolha o médico.");
  const key = doctorKey(doctor);
  if (!room) {
    await prisma.doctorRoom.deleteMany({ where: { clinicId, doctorKey: key } });
  } else {
    await prisma.doctorRoom.upsert({
      where: { clinicId_doctorKey: { clinicId, doctorKey: key } },
      update: { room, doctor },
      create: { clinicId, doctorKey: key, doctor, room },
    });
  }
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

/** Gera o link da TV. O endereço completo só aparece agora — guarde ou gere outro. */
export async function createTvLink(name: string): Promise<{ id: string; url: string }> {
  const { clinicId } = await requireClinicManager();
  const { id, raw } = await issueTvDisplay(clinicId, name);
  revalidatePath("/clinic/tv");
  return { id, url: `${getBaseUrl()}/tv/${raw}` };
}

export async function revokeTvLink(id: string) {
  const { clinicId } = await requireClinicManager();
  await prisma.tvDisplay.updateMany({ where: { id, clinicId, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/clinic/tv");
  return { success: true as const };
}

/** Salas fixas pra quem chama (recepção/médico) mostrar a sugestão e trocar na hora. */
export async function getDoctorRooms(): Promise<{ doctor: string; room: string }[]> {
  const { clinicId } = await requireClinicPermission("chamar");
  const rows = await prisma.doctorRoom.findMany({ where: { clinicId }, select: { doctor: true, room: true } });
  return rows;
}

// ── Lado da TV (sem login, só o token do link) ──────────────────────────────────

export async function getTvState(token: string): Promise<{ clinicName: string; topic: string | null; calls: TvCall[] } | null> {
  const tv = await resolveTvDisplay(token);
  if (!tv) return null;
  const clinic = await prisma.clinic.findUnique({ where: { id: tv.clinicId }, select: { name: true } });
  return { clinicName: clinic?.name ?? "", topic: tvTopicFor(tv.clinicId), calls: await recentCalls(tv.clinicId) };
}

export async function getTvCall(token: string, id: string): Promise<TvCall | null> {
  const tv = await resolveTvDisplay(token);
  if (!tv) return null;
  const row = await prisma.patientCall.findFirst({ where: { id, clinicId: tv.clinicId } });
  return row ? toTvCall(row) : null;
}
