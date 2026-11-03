import "server-only";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashPatientToken } from "@/lib/patient-token";
import { loadAgenda } from "@/lib/agenda-server";
import { todayInBahia } from "@/lib/agenda-ui";
import { notifyAgenda } from "@/lib/realtime-server";
import { recordAudit } from "@/lib/audit-server";
import { createPatientCall } from "@/lib/tv-call-server";
import { tvDisplayName, type TvCall } from "@/lib/tv-call";
import { seriesFor, doctorDelayMin, matchTicketAppointment, nextTicket, ticketCode, ticketsAhead, type QueueTicketLite, type TicketStatus, type TicketType } from "@/lib/queue-ticket";

export type IssuedTicket = {
  code: string;
  type: TicketType;
  followToken: string;
  /** "Lucas M." quando achou a consulta de hoje; null = sem agendamento. */
  patient: string | null;
  appointmentTime: string | null;
  ahead: number;
  createdAt: string;
  serviceName: string | null;
};

/** Telefones pra procurar a consulta: o número digitado e, se tiver 11 dígitos (pode ser
 * CPF), os telefones de quem tem esse CPF no cadastro desta clínica ou num agendamento. */
async function phonesFor(clinicId: string, digits: string, day: string): Promise<string[]> {
  const phones: string[] = [];
  if (digits.length >= 10) phones.push(digits);
  if (digits.length === 11) {
    const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
    const [profiles, appts] = await Promise.all([
      prisma.contactClinicProfile.findMany({
        where: { clinicId, cpf: { in: [digits, formatted] } },
        select: { contact: { select: { phone: true } } },
        take: 5,
      }),
      prisma.appointment.findMany({
        where: { clinicProcedure: { clinicId }, patientCpf: digits, date: new Date(`${day}T00:00:00Z`) },
        select: { patientPhone: true },
        take: 5,
      }),
    ]);
    phones.push(...profiles.map((p) => p.contact.phone ?? ""), ...appts.map((a) => a.patientPhone));
  }
  return phones;
}

/** Senhas esperando hoje; com `serviceId` (ou null = sem serviço), só as daquele serviço. */
async function waitingToday(clinicId: string, day: string, serviceId?: string | null): Promise<(QueueTicketLite & { code: string })[]> {
  const rows = await prisma.queueTicket.findMany({
    where: { clinicId, day, status: "WAITING", ...(serviceId !== undefined ? { serviceId } : {}) },
    select: { id: true, type: true, status: true, createdAt: true, code: true, serviceId: true },
  });
  return rows.map((r) => ({ ...r, type: r.type as TicketType, status: r.status as TicketStatus }));
}

/** Totem: tira a senha. Se achar a consulta de hoje pelo CPF/telefone, liga a senha a ela
 * e marca "Chegou" na Agenda (como o "Cheguei" do link do paciente). */
export async function issueQueueTicket(clinicId: string, input: { type: TicketType; identifier?: string | null; serviceId?: string | null }): Promise<IssuedTicket> {
  const service = input.serviceId
    ? await prisma.queueService.findFirst({ where: { id: input.serviceId, clinicId, active: true }, select: { id: true, name: true, letter: true } })
    : null;
  if (input.serviceId && !service) throw new Error("Serviço indisponível.");
  const series = seriesFor(service?.letter, input.type);
  const day = todayInBahia();
  const digits = (input.identifier ?? "").replace(/\D/g, "");
  let match: Awaited<ReturnType<typeof loadAgenda>>["items"][number] | null = null;
  if (digits.length >= 10) {
    const [phones, agenda] = await Promise.all([phonesFor(clinicId, digits, day), loadAgenda(clinicId, day, day)]);
    match = matchTicketAppointment(agenda.items, phones);
  }

  const raw = randomBytes(18).toString("base64url");
  let row: Awaited<ReturnType<typeof prisma.queueTicket.create>> | null = null;
  for (let attempt = 0; attempt < 5 && !row; attempt++) {
    const last = await prisma.queueTicket.findFirst({ where: { clinicId, day, series }, orderBy: { number: "desc" }, select: { number: true } });
    const number = (last?.number ?? 0) + 1;
    try {
      row = await prisma.queueTicket.create({
        data: {
          clinicId,
          day,
          type: input.type,
          number,
          series,
          serviceId: service?.id ?? null,
          serviceName: service?.name ?? null,
          code: ticketCode(series, number),
          followTokenHash: hashPatientToken(raw),
          patientName: match?.patientName ?? null,
          phone: match?.phone ?? null,
          doctor: match?.doctor ?? null,
          appointmentSource: match?.source ?? null,
          appointmentExtId: match?.externalId ?? null,
          appointmentTime: match?.time ?? null,
        },
      });
    } catch (e) {
      if ((e as { code?: string }).code !== "P2002") throw e; // dois toques ao mesmo tempo: tenta o próximo número
    }
  }
  if (!row) throw new Error("Não deu pra gerar a senha. Tente de novo.");

  if (match) await markArrived(clinicId, match);
  await notifyAgenda(clinicId);
  const waiting = await waitingToday(clinicId, day, service?.id ?? null);
  return {
    code: row.code,
    type: input.type,
    followToken: raw,
    patient: match ? tvDisplayName(match.patientName) : null,
    appointmentTime: match?.time ?? null,
    ahead: ticketsAhead(waiting, row.id),
    createdAt: row.createdAt.toISOString(),
    serviceName: service?.name ?? null,
  };
}

async function markArrived(clinicId: string, item: { source: "BRIDGE" | "LOCAL"; externalId: string; date: string; phone: string | null }) {
  const key = { clinicId_source_externalId: { clinicId, source: item.source, externalId: item.externalId } };
  const before = await prisma.agendaMark.findUnique({ where: key, select: { status: true } });
  // Já marcado pela recepção (chegou/atendido/…): não sobrescreve.
  if (before && before.status !== "CONFIRMED") return;
  await prisma.agendaMark.upsert({
    where: key,
    update: { status: "IN_SERVICE", updatedByUserId: null },
    create: { clinicId, source: item.source, externalId: item.externalId, date: new Date(`${item.date}T00:00:00Z`), status: "IN_SERVICE", phone: item.phone },
  });
  await recordAudit({
    clinicId,
    userId: null,
    action: "totem.checkin",
    entity: `agenda:${item.source}`,
    entityId: item.externalId,
    before: before ? { status: before.status } : null,
    after: { status: "IN_SERVICE" },
  });
}

export type QueueTicketView = {
  id: string;
  code: string;
  type: TicketType;
  status: TicketStatus;
  patientName: string | null;
  doctor: string | null;
  appointmentTime: string | null;
  room: string | null;
  callCount: number;
  createdAt: string;
  calledAt: string | null;
  serviceId: string | null;
  serviceName: string | null;
};

/** Senhas de hoje (tela da recepção/médico). */
export async function queueToday(clinicId: string): Promise<QueueTicketView[]> {
  const rows = await prisma.queueTicket.findMany({ where: { clinicId, day: todayInBahia() }, orderBy: { createdAt: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    type: r.type as TicketType,
    status: r.status as TicketStatus,
    patientName: r.patientName,
    doctor: r.doctor,
    appointmentTime: r.appointmentTime,
    room: r.room,
    callCount: r.callCount,
    createdAt: r.createdAt.toISOString(),
    calledAt: r.calledAt?.toISOString() ?? null,
    serviceId: r.serviceId,
    serviceName: r.serviceName,
  }));
}

/** Chama uma senha na TV (ticketId) ou a próxima da fila (sem ticketId). */
/** `serviceIds` = guichê que só atende alguns serviços ("Chamar próxima" só pega deles). */
export async function callQueueTicket(clinicId: string, userId: string, input: { ticketId?: string | null; room: string; serviceIds?: string[] | null }): Promise<{ code: string; call: TvCall } | null> {
  const room = input.room.trim().slice(0, 40) || null;
  let ticket = input.ticketId ? await prisma.queueTicket.findFirst({ where: { id: input.ticketId, clinicId } }) : null;
  if (!input.ticketId) {
    const waiting = input.serviceIds?.length
      ? (await waitingToday(clinicId, todayInBahia())).filter((t) => input.serviceIds!.includes((t as { serviceId?: string | null }).serviceId ?? ""))
      : await waitingToday(clinicId, todayInBahia());
    const next = nextTicket(waiting);
    if (!next) return null;
    ticket = await prisma.queueTicket.findUnique({ where: { id: next.id } });
  }
  if (!ticket) throw new Error("Senha não encontrada.");
  // Corrida entre dois guichês chamando "próxima": só um leva a senha.
  const updated = await prisma.queueTicket.updateMany({
    where: { id: ticket.id, ...(input.ticketId ? {} : { status: "WAITING" }) },
    data: { status: "CALLED", room, calledAt: new Date(), calledByUserId: userId, callCount: { increment: 1 } },
  });
  if (updated.count === 0) return callQueueTicket(clinicId, userId, input);
  const call = await createPatientCall(clinicId, userId, {
    source: "TICKET",
    externalId: ticket.id,
    patientName: ticket.patientName ?? "",
    doctor: null,
    room,
    ticketCode: ticket.code,
  });
  await notifyAgenda(clinicId);
  return { code: ticket.code, call };
}

export async function finishQueueTicket(clinicId: string, id: string, status: "DONE" | "NO_SHOW" | "CANCELLED" | "WAITING") {
  const res = await prisma.queueTicket.updateMany({
    where: { id, clinicId },
    data: { status, finishedAt: status === "WAITING" ? null : new Date() },
  });
  if (res.count === 0) throw new Error("Senha não encontrada.");
  await notifyAgenda(clinicId);
}

export type TicketFollow = {
  code: string;
  clinicName: string;
  status: TicketStatus;
  ahead: number;
  room: string | null;
  calledAt: string | null;
  createdAt: string;
  /** Médico da consulta ligada à senha e atraso estimado dele (min); null = sem dado. */
  doctor: string | null;
  delayMin: number | null;
};

/** Página do QR Code: posição na fila. Só vale no dia da senha. */
export async function followQueueTicket(raw: string): Promise<TicketFollow | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(raw)) return null;
  const t = await prisma.queueTicket.findUnique({ where: { followTokenHash: hashPatientToken(raw) } });
  if (!t || t.day !== todayInBahia()) return null;
  const [waiting, clinic, sameDoctor] = await Promise.all([
    t.status === "WAITING" ? waitingToday(t.clinicId, t.day, t.serviceId) : Promise.resolve([]),
    prisma.clinic.findUnique({ where: { id: t.clinicId }, select: { name: true } }),
    t.status === "WAITING" && t.doctor
      ? prisma.queueTicket.findMany({ where: { clinicId: t.clinicId, day: t.day, status: "WAITING", doctor: { not: null } }, select: { doctor: true, appointmentTime: true, status: true } })
      : Promise.resolve([]),
  ]);
  const nowBR = new Date(Date.now() - 3 * 3600_000);
  return {
    code: t.code,
    clinicName: clinic?.name ?? "",
    status: t.status as TicketStatus,
    ahead: t.status === "WAITING" ? ticketsAhead(waiting, t.id) : 0,
    room: t.room,
    calledAt: t.calledAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    doctor: t.doctor,
    delayMin: doctorDelayMin(sameDoctor, t.doctor, nowBR.getUTCHours() * 60 + nowBR.getUTCMinutes()),
  };
}

// ── Serviços (Consulta, Exame, Resultado…) ─────────────────────────────────────

const DEFAULT_SERVICES = [
  { name: "Consulta", letter: "C" },
  { name: "Exame", letter: "E" },
  { name: "Resultado", letter: "R" },
];

export type QueueServiceView = { id: string; name: string; letter: string; active: boolean };

/** Serviços da clínica; na 1ª vez cria Consulta/Exame/Resultado. */
export async function listQueueServices(clinicId: string, onlyActive = false): Promise<QueueServiceView[]> {
  let rows = await prisma.queueService.findMany({ where: { clinicId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  if (rows.length === 0) {
    await prisma.queueService.createMany({ data: DEFAULT_SERVICES.map((d, i) => ({ clinicId, ...d, position: i })), skipDuplicates: true });
    rows = await prisma.queueService.findMany({ where: { clinicId }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] });
  }
  return rows.filter((r) => !onlyActive || r.active).map((r) => ({ id: r.id, name: r.name, letter: r.letter, active: r.active }));
}
