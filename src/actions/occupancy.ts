"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager } from "@/lib/session";
import { loadAgenda } from "@/lib/agenda-server";
import { addDays } from "@/lib/agenda";
import { todayInBahia } from "@/lib/agenda-ui";
import { doctorKey } from "@/lib/tv-call";
import { computeOccupancy, normalizeDoctor, parseRoomHours, type RoomConfig, type RoomHours, type RoomKind } from "@/lib/room-occupancy";

export type OccupancyPeriod = "7" | "30" | "next7";

export type RoomView = RoomConfig & { doctors: string[] };

function toConfig(r: { id: string; name: string; kind: string; hours: unknown; procedureKeywords: string[]; slotMinutes: number }): RoomConfig {
  return {
    id: r.id,
    name: r.name,
    kind: r.kind === "PROCEDIMENTO" ? "PROCEDIMENTO" : "CONSULTORIO",
    hours: parseRoomHours(r.hours),
    procedureKeywords: r.procedureKeywords,
    slotMinutes: r.slotMinutes,
  };
}

function periodDays(period: OccupancyPeriod): string[] {
  const today = todayInBahia();
  const days: string[] = [];
  if (period === "next7") for (let i = 0; i < 7; i++) days.push(addDays(today, i));
  else for (let i = Number(period); i >= 1; i--) days.push(addDays(today, -i));
  return days;
}

/** Relatório › Ocupação: salas cadastradas + marcações do período (ponte + Conecta). */
export async function getClinicOccupancy(period: OccupancyPeriod) {
  const { clinicId } = await requireClinicManager();
  const days = periodDays(period);
  const [roomRows, doctorRows, agenda] = await Promise.all([
    prisma.clinicRoom.findMany({ where: { clinicId }, orderBy: [{ kind: "asc" }, { name: "asc" }] }),
    prisma.doctorRoom.findMany({ where: { clinicId }, select: { doctor: true, room: true } }),
    loadAgenda(clinicId, days[0], days[days.length - 1]),
  ]);
  const rooms = roomRows.map(toConfig);
  const doctorRooms = new Map(doctorRows.map((d) => [normalizeDoctor(d.doctor), d.room]));
  const result = computeOccupancy(agenda.items, rooms, doctorRooms, days);
  const allDoctors = [...new Set(agenda.items.map((i) => i.doctor).filter((d): d is string => !!d))].sort();
  return {
    days,
    ...result,
    roomsConfig: rooms.map<RoomView>((r) => ({
      ...r,
      doctors: doctorRows.filter((d) => d.room.trim().toLowerCase() === r.name.trim().toLowerCase()).map((d) => d.doctor),
    })),
    doctorRooms: doctorRows,
    allDoctors,
    hasBridge: agenda.hasBridge,
    bridgeFailedDays: agenda.bridgeFailedDays,
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function saveClinicRoom(input: {
  id?: string;
  name: string;
  kind: RoomKind;
  hours: RoomHours[];
  procedureKeywords: string[];
  slotMinutes: number;
}) {
  const { clinicId } = await requireClinicManager();
  const name = input.name.trim().slice(0, 40);
  if (!name) throw new Error("Dê um nome para a sala.");
  const hours = parseRoomHours(input.hours);
  if (input.hours.some((h) => !HHMM.test(h.start) || !HHMM.test(h.end) || h.end <= h.start)) {
    throw new Error("Confira os horários: use HH:MM e o fim depois do início.");
  }
  const slotMinutes = Math.round(input.slotMinutes);
  if (!Number.isFinite(slotMinutes) || slotMinutes < 5 || slotMinutes > 240) throw new Error("Duração padrão entre 5 e 240 minutos.");
  const procedureKeywords =
    input.kind === "PROCEDIMENTO" ? [...new Set(input.procedureKeywords.map((k) => k.trim()).filter(Boolean))].slice(0, 30) : [];
  const data = { name, kind: input.kind === "PROCEDIMENTO" ? "PROCEDIMENTO" : "CONSULTORIO", hours, procedureKeywords, slotMinutes };
  if (input.id) {
    const own = await prisma.clinicRoom.findFirst({ where: { id: input.id, clinicId }, select: { name: true } });
    if (!own) throw new Error("Sala não encontrada.");
    await prisma.clinicRoom.update({ where: { id: input.id }, data });
    // Renomeou: os médicos ligados à sala acompanham (DoctorRoom guarda o nome).
    if (own.name !== name) await prisma.doctorRoom.updateMany({ where: { clinicId, room: own.name }, data: { room: name } });
  } else {
    await prisma.clinicRoom.create({ data: { ...data, clinicId } });
  }
  revalidatePath("/clinic/relatorio");
  return { success: true as const };
}

export async function deleteClinicRoom(id: string) {
  const { clinicId } = await requireClinicManager();
  await prisma.clinicRoom.deleteMany({ where: { id, clinicId } });
  revalidatePath("/clinic/relatorio");
  return { success: true as const };
}

/** Liga o médico a um consultório — é a mesma "sala fixa" do painel da TV. room "" desliga. */
export async function setDoctorRoomForOccupancy(doctor: string, room: string) {
  const { clinicId } = await requireClinicManager();
  const name = doctor.trim();
  if (!name) throw new Error("Escolha o médico.");
  const key = doctorKey(name);
  if (!room.trim()) {
    await prisma.doctorRoom.deleteMany({ where: { clinicId, doctorKey: key } });
  } else {
    await prisma.doctorRoom.upsert({
      where: { clinicId_doctorKey: { clinicId, doctorKey: key } },
      update: { room: room.trim().slice(0, 40), doctor: name },
      create: { clinicId, doctorKey: key, doctor: name, room: room.trim().slice(0, 40) },
    });
  }
  revalidatePath("/clinic/relatorio");
  return { success: true as const };
}
