"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { startSlotOfferForItem } from "@/lib/slot-offer-server";
import { prisma } from "@/lib/prisma";
import { requireClinicPermission, requireClinicSession } from "@/lib/session";
import { createPatientCall } from "@/lib/tv-call-server";
import { readAppointmentFormResponse } from "@/lib/patient-form-view-server";
import { doctorKey, type TvCall } from "@/lib/tv-call";
import { todayInBahia } from "@/lib/agenda-ui";
import { loadAgenda, type AgendaResult } from "@/lib/agenda-server";
import { agendaTopicFor, notifyAgenda } from "@/lib/realtime-server";
import { recordAudit } from "@/lib/audit-server";
import { toggleNinthDigit } from "@/lib/whatsapp";
import {
  MANUAL_AGENDA_STATUSES,
  type AgendaItem,
  type ManualAgendaStatus,
} from "@/lib/agenda";

export type { AgendaResult };

/** Agenda de `from` a `to` (inclusive, AAAA-MM-DD): ponte + agendamentos do Conecta,
 * com o status de cada marcação (ver resolveAgendaStatus). */
export async function getAgenda(from: string, to: string): Promise<AgendaResult> {
  const { clinicId } = await requireClinicSession();
  return loadAgenda(clinicId, from, to);
}

/** Recepção marca o status de uma marcação (presente, atendido, falta…). Só no Conecta —
 * o sistema da clínica não é alterado. */
export async function setAgendaStatus(input: {
  source: "BRIDGE" | "LOCAL";
  externalId: string;
  date: string;
  /** Telefone do paciente — pro relatório de marcadores (atendidos). */
  phone?: string | null;
  /** "AUTO" apaga a marcação manual — volta a valer o status automático (lembrete). */
  status: ManualAgendaStatus | "AUTO";
  /** Desfazer "Atendido": volta pra fila com a hora de chegada original (não "agora"). */
  arrivedAt?: string | null;
}): Promise<{ success: true }> {
  const { clinicId, userId } = await requireClinicSession();
  return applyAgendaStatus(clinicId, userId, input);
}

/** Miolo do setAgendaStatus, sem checar sessão (a tela do médico checa "chamar"). */
async function applyAgendaStatus(
  clinicId: string,
  userId: string,
  input: Parameters<typeof setAgendaStatus>[0],
): Promise<{ success: true }> {
  if (input.status !== "AUTO" && !(MANUAL_AGENDA_STATUSES as readonly string[]).includes(input.status)) {
    throw new Error("Status inválido.");
  }
  if (input.source === "LOCAL") {
    const appt = await prisma.appointment.findFirst({
      where: { id: input.externalId, clinicProcedure: { clinicId } },
      select: { id: true },
    });
    if (!appt) throw new Error("Agendamento não encontrado.");
  }
  const date = new Date(`${input.date}T00:00:00Z`);
  const markKey = { clinicId_source_externalId: { clinicId, source: input.source, externalId: input.externalId } };
  const before = await prisma.agendaMark.findUnique({ where: markKey, select: { status: true } });
  const audit = (to: string | null) =>
    recordAudit({
      clinicId,
      userId,
      action: "agenda.status",
      entity: `agenda:${input.source}`,
      entityId: input.externalId,
      before: before ? { status: before.status } : null,
      after: to ? { status: to } : null,
    });
  if (input.status === "AUTO") {
    await prisma.agendaMark.deleteMany({ where: { clinicId, source: input.source, externalId: input.externalId } });
    await audit(null);
    await notifyAgenda(clinicId);
    revalidatePath("/clinic/agenda");
    return { success: true };
  }
  // A fila de chegada ordena por updatedAt; ao desfazer, reaproveita a chegada original
  // (só se for de até 24 h atrás — nunca no futuro).
  const kept = input.status === "IN_SERVICE" && input.arrivedAt ? new Date(input.arrivedAt) : null;
  const updatedAt = kept && !isNaN(kept.getTime()) && kept.getTime() <= Date.now() && Date.now() - kept.getTime() < 86_400_000 ? kept : undefined;
  await prisma.agendaMark.upsert({
    where: { clinicId_source_externalId: { clinicId, source: input.source, externalId: input.externalId } },
    update: { status: input.status, updatedByUserId: userId, date, phone: input.phone ?? undefined, ...(updatedAt ? { updatedAt } : {}) },
    create: { clinicId, source: input.source, externalId: input.externalId, date, status: input.status, updatedByUserId: userId, phone: input.phone ?? null, ...(updatedAt ? { updatedAt } : {}) },
  });
  await audit(input.status);
  await notifyAgenda(clinicId);
  if (input.status === "CANCELLED" || input.status === "NO_SHOW") {
    // Lista de espera automática (se ligada): roda depois da resposta pra não travar a tela.
    after(() => startSlotOfferForItem(clinicId, { source: input.source, externalId: input.externalId, date: input.date, phone: input.phone }));
  }
  revalidatePath("/clinic/agenda");
  return { success: true };
}

/** Tópico do aviso "a Agenda mudou" desta clínica (Realtime). */
export async function getAgendaRealtimeTopic(): Promise<string | null> {
  const { clinicId } = await requireClinicSession();
  return agendaTopicFor(clinicId);
}

/** Painel lateral do paciente na Agenda: conversa no Chat (pra abrir a ficha e o
 * WhatsApp) e histórico curto de agendamentos/lembretes pelo telefone. */
export async function getAgendaPatient(phone: string | null) {
  const { clinicId } = await requireClinicSession();
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-8);
  if (tail.length < 8) return null;
  const conversation = await prisma.conversation.findFirst({
    where: { clinicId, contact: { phone: { endsWith: tail } } },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true, lastMessageAt: true, contact: { select: { name: true } }, assignedUser: { select: { name: true } } },
  });
  const phones = [digits, toggleNinthDigit(digits)].filter((p): p is string => !!p);
  const [appointments, reminders] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicProcedure: { clinicId }, patientPhone: { endsWith: tail } },
      orderBy: { date: "desc" },
      take: 5,
      select: { date: true, timeSlot: true, status: true, clinicProcedure: { select: { procedure: { select: { name: true } } } } },
    }),
    prisma.bridgeReminderLog.findMany({
      where: { clinicId, OR: [{ phone: { in: phones } }, { phone: { endsWith: tail } }] },
      orderBy: { sentAt: "desc" },
      take: 5,
      select: { sentAt: true, response: true },
    }),
  ]);
  return {
    conversationId: conversation?.id ?? null,
    contactName: conversation?.contact.name ?? null,
    lastMessageAt: conversation?.lastMessageAt?.toISOString() ?? null,
    assignedTo: conversation?.assignedUser?.name ?? null,
    appointments: appointments.map((a) => ({
      date: a.date.toISOString().slice(0, 10),
      time: a.timeSlot,
      status: a.status,
      procedure: a.clinicProcedure.procedure.name,
    })),
    reminders: reminders.map((r) => ({ sentAt: r.sentAt.toISOString(), response: r.response })),
  };
}

export type AgendaPatient = NonNullable<Awaited<ReturnType<typeof getAgendaPatient>>>;

// ── Tela do médico (/clinic/medico): só os pacientes dele, hoje ─────────────────

async function requireDoctor() {
  const s = await requireClinicPermission("chamar");
  const user = await prisma.user.findUnique({ where: { id: s.userId }, select: { doctorName: true, clinicRole: true } });
  return { ...s, doctorName: user?.doctorName?.trim() || null, isDoctor: user?.clinicRole === "MEDICO" };
}

/** Pacientes de hoje do médico logado. Sem nome de médico ligado ao login → lista vazia
 * com aviso (o admin liga em Admin › Clínica › Atendentes). */
export async function getMyPatientsToday(): Promise<{ doctorName: string | null; date: string; items: AgendaItem[] }> {
  const { clinicId, doctorName } = await requireDoctor();
  const date = todayInBahia();
  if (!doctorName) return { doctorName: null, date, items: [] };
  const key = doctorKey(doctorName);
  const { items } = await loadAgenda(clinicId, date, date);
  return { doctorName, date, items: items.filter((i) => i.doctor && doctorKey(i.doctor) === key) };
}

/** Acha a consulta de hoje do médico logado pelo id — o nome do paciente vem do servidor. */
async function myItem(ref: { source: "BRIDGE" | "LOCAL"; externalId: string }) {
  const me = await requireDoctor();
  const { items } = await getMyPatientsTodayFor(me.clinicId, me.doctorName);
  const item = items.find((i) => i.source === ref.source && i.externalId === ref.externalId);
  if (!item) throw new Error("Paciente não está na sua agenda de hoje.");
  return { me, item };
}

async function getMyPatientsTodayFor(clinicId: string, doctorName: string | null) {
  if (!doctorName) return { items: [] as AgendaItem[] };
  const key = doctorKey(doctorName);
  const { items } = await loadAgenda(clinicId, todayInBahia(), todayInBahia());
  return { items: items.filter((i) => i.doctor && doctorKey(i.doctor) === key) };
}

/** Médico chama: marca "Em atendimento" e anuncia na TV. */
export async function doctorCallPatient(ref: { source: "BRIDGE" | "LOCAL"; externalId: string; room?: string | null }): Promise<TvCall> {
  const { me, item } = await myItem(ref);
  await applyAgendaStatus(me.clinicId, me.userId, { source: item.source, externalId: item.externalId, date: item.date, phone: item.phone, status: "IN_ROOM" });
  return createPatientCall(me.clinicId, me.userId, { source: item.source, externalId: item.externalId, patientName: item.patientName, doctor: item.doctor, room: ref.room });
}

/** Médico encerra (Atendido) ou marca falta. */
export async function doctorSetStatus(ref: { source: "BRIDGE" | "LOCAL"; externalId: string; status: "COMPLETED" | "NO_SHOW" | "IN_SERVICE" }) {
  if (!["COMPLETED", "NO_SHOW", "IN_SERVICE"].includes(ref.status)) throw new Error("Status inválido.");
  const { me, item } = await myItem(ref);
  return applyAgendaStatus(me.clinicId, me.userId, { source: item.source, externalId: item.externalId, date: item.date, phone: item.phone, status: ref.status });
}

/** Tópico "Agenda mudou" pra tela do médico atualizar sozinha (paciente fez "Cheguei"). */
export async function getDoctorRealtimeTopic(): Promise<string | null> {
  const { clinicId } = await requireDoctor();
  return agendaTopicFor(clinicId);
}

/** Médico abre a ficha prévia de um paciente DELE, de hoje (registrado em Acessos). */
export async function doctorFormResponse(ref: { source: "BRIDGE" | "LOCAL"; externalId: string }) {
  const { me, item } = await myItem(ref);
  return readAppointmentFormResponse(me.clinicId, me.userId, { source: item.source, externalId: item.externalId });
}
