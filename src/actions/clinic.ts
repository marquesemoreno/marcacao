"use server";

import { revalidatePath } from "next/cache";
import type { AppointmentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { startOfUTCDay, addUTCDays } from "@/lib/date";
import {
  updateClinicProcedureSchema,
  addClinicProcedureSchema,
  updateAppointmentStatusSchema,
  businessHoursSchema,
  type BusinessHours,
} from "@/lib/schemas/clinic";
import { notifyAppointmentStatus } from "@/lib/whatsapp";
import {
  computeAttendantPerformance,
  computeConfirmationStats,
  computeTopDoctors,
  computeKindDistribution,
  computeHourlyInbound,
} from "@/lib/report-metrics";

export async function getClinicInfo() {
  const { clinicId } = await requireClinicSession();
  return prisma.clinic.findUniqueOrThrow({
    where: { id: clinicId },
    include: { whatsappInstance: { select: { id: true } } },
  });
}

export async function getClinicOverview() {
  const { clinicId } = await requireClinicSession();
  const todayStart = startOfUTCDay(new Date());
  const weekEnd = addUTCDays(todayStart, 7);

  const [todayCount, weekCount, pendingCount] = await Promise.all([
    prisma.appointment.count({
      where: { clinicProcedure: { clinicId }, date: todayStart },
    }),
    prisma.appointment.count({
      where: { clinicProcedure: { clinicId }, date: { gte: todayStart, lt: weekEnd } },
    }),
    prisma.appointment.count({
      where: { clinicProcedure: { clinicId }, status: "PENDING" },
    }),
  ]);

  return { todayCount, weekCount, pendingCount };
}

export async function listClinicAppointments(filters?: { status?: AppointmentStatus }) {
  const { clinicId } = await requireClinicSession();
  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      ...(filters?.status ? { status: filters.status } : {}),
    },
    orderBy: [{ date: "asc" }, { timeSlot: "asc" }],
    include: { clinicProcedure: { include: { procedure: true } } },
  });
}

/** Nomes distintos de tags usadas nas conversas da clínica no período — popula o
 * filtro "Tags" do relatório (ver /clinic/relatorio). Simples lista pra filtro, não
 * é gestão de tags (essa feature foi removida — ver memória do projeto). */
export async function getDistinctConversationTags(days: number = 30) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);
  const conversations = await prisma.conversation.findMany({
    where: { clinicId, createdAt: { gte: since }, tags: { isEmpty: false } },
    select: { tags: true },
  });
  return [...new Set(conversations.flatMap((c) => c.tags))].sort();
}

/** Relatório de atendimento/chat da clínica (ver /clinic/relatorio) — mesma lógica de
 * getAttendantPerformanceReport/getConversationQualityReport (admin.ts), só que filtrada
 * por clinicId em vez da plataforma inteira. Duplicado de propósito (mesmo padrão
 * clínica/admin usado no resto do projeto) em vez de generalizar as funções do admin.
 * `tags`, quando informado, filtra pra conversas que tenham QUALQUER uma delas. */
export async function getClinicChatReport(days: number = 30, tags?: string[]) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);
  const tagsFilter = tags && tags.length > 0 ? { tags: { hasSome: tags } } : {};

  const [conversations, audits] = await Promise.all([
    prisma.conversation.findMany({
      where: { clinicId, createdAt: { gte: since }, ...tagsFilter },
      select: { id: true, status: true, resolutionReason: true, createdAt: true, resolvedAt: true },
    }),
    // Filtra pela data da CONVERSA, não do audit — um audit é criado só quando a conversa
    // é resolvida, então filtrar pela própria data do audit deixava entrar conversas
    // abertas há semanas e resolvidas só agora, distorcendo a média de resolução pra
    // muito acima da realidade (bug real: média de 118h só por causa de 1 conversa velha).
    prisma.conversationQualityAudit.findMany({
      where: { conversation: { clinicId, createdAt: { gte: since }, ...tagsFilter } },
      select: { sentiment: true, firstResponseSec: true, resolutionSec: true },
    }),
  ]);

  const totalResolved = conversations.filter((c) => c.status === "RESOLVED").length;
  const totalAgendados = conversations.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length;
  const conversionRate = totalResolved > 0 ? Math.round((totalAgendados / totalResolved) * 1000) / 10 : 0;

  const withFrt = audits.filter((a) => a.firstResponseSec !== null);
  // Resolução só entra na média se a conversa teve resposta de verdade (firstResponseSec
  // não-nulo) — sem esse filtro, uma conversa esquecida por dias (sem ninguém responder)
  // e resolvida só depois pelo cron de "sem retorno" pesava sozinha a média pra centenas
  // de horas, mesmo não representando nenhum atendimento de fato.
  const withTtr = audits.filter((a) => a.resolutionSec !== null && a.firstResponseSec !== null);
  const avgFrtSec = withFrt.length > 0 ? Math.round(withFrt.reduce((acc, a) => acc + a.firstResponseSec!, 0) / withFrt.length) : null;
  const avgTtrSec = withTtr.length > 0 ? Math.round(withTtr.reduce((acc, a) => acc + a.resolutionSec!, 0) / withTtr.length) : null;

  const withSentiment = audits.filter((a) => a.sentiment !== null);
  const sentimentCounts = { POSITIVO: 0, NEUTRO: 0, NEGATIVO: 0 } as Record<string, number>;
  for (const a of withSentiment) {
    if (a.sentiment) sentimentCounts[a.sentiment] = (sentimentCounts[a.sentiment] ?? 0) + 1;
  }
  const sentimentPct = (key: string) =>
    withSentiment.length > 0 ? Math.round(((sentimentCounts[key] ?? 0) / withSentiment.length) * 1000) / 10 : 0;

  return {
    totalConversations: conversations.length,
    totalResolved,
    totalAgendados,
    conversionRate,
    avgFrtSec,
    avgTtrSec,
    sentimentPositivePct: sentimentPct("POSITIVO"),
    sentimentNeutroPct: sentimentPct("NEUTRO"),
    sentimentNegativoPct: sentimentPct("NEGATIVO"),
    sentimentAuditedCount: withSentiment.length,
  };
}

/** Relatório de agendamentos da clínica (ver /clinic/relatorio) — mesma fonte de valor
 * (clinicProcedure.price/promotionalPrice) já usada em getFinancialReport (admin.ts).
 * `doctorName`/`procedureId`, quando informados, filtram os agendamentos — só fazem
 * sentido aqui (não no relatório de chat): não existe vínculo entre Conversation e
 * Appointment no banco, então médico/procedimento não dá pra filtrar conversas. */
export async function getClinicAppointmentsReport(days: number = 30, doctorName?: string, procedureId?: string) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId, ...(procedureId ? { procedureId } : {}) },
      createdAt: { gte: since },
      ...(doctorName ? { doctorName } : {}),
    },
    include: { clinicProcedure: { include: { procedure: true } } },
  });

  const countByStatus: Record<AppointmentStatus, number> = {
    PENDING: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };
  for (const a of appointments) countByStatus[a.status]++;

  const completed = appointments.filter((a) => a.status === "COMPLETED");
  const revenue = completed.reduce(
    (sum, a) => sum + Number(a.clinicProcedure.promotionalPrice ?? a.clinicProcedure.price),
    0
  );

  const cancelledOrNoShow = countByStatus.CANCELLED + countByStatus.NO_SHOW;
  const cancellationRate = appointments.length > 0 ? Math.round((cancelledOrNoShow / appointments.length) * 1000) / 10 : 0;

  const procedureCounts = new Map<string, number>();
  for (const a of appointments) {
    const name = a.clinicProcedure.procedure.name;
    procedureCounts.set(name, (procedureCounts.get(name) ?? 0) + 1);
  }
  const topProcedures = [...procedureCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    totalAppointments: appointments.length,
    countByStatus,
    cancellationRate,
    revenue,
    topProcedures,
  };
}

/** Métricas de gestão do /clinic/relatorio (equipe, confirmações, médicos, tipo de
 * atendimento, horário de pico). Agregação em src/lib/report-metrics.ts. O atendente de
 * uma conversa é quem a resolveu (resolvedByUserId), senão quem está atribuído. */
export async function getClinicManagementReport(days: number = 30) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const [conversations, appointments, inbound] = await Promise.all([
    prisma.conversation.findMany({
      where: { clinicId, createdAt: { gte: since } },
      select: {
        status: true,
        resolutionReason: true,
        resolvedByUserId: true,
        assignedUserId: true,
        qualityAudit: { select: { firstResponseSec: true } },
      },
    }),
    prisma.appointment.findMany({
      where: { clinicProcedure: { clinicId }, createdAt: { gte: since } },
      select: {
        doctorName: true,
        status: true,
        date: true,
        reminderSentAt: true,
        reminderStatus: true,
        clinicProcedure: { select: { procedure: { select: { name: true, category: true } } } },
      },
    }),
    prisma.message.findMany({
      where: { direction: "INBOUND", createdAt: { gte: since }, conversation: { clinicId } },
      select: { createdAt: true },
    }),
  ]);

  const userIds = [
    ...new Set(conversations.map((c) => c.resolvedByUserId ?? c.assignedUserId).filter((id): id is string => !!id)),
  ];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userNames = new Map(users.map((u) => [u.id, u.name]));

  const attendants = computeAttendantPerformance(
    conversations.map((c) => {
      const userId = c.resolvedByUserId ?? c.assignedUserId;
      return {
        userId,
        userName: userId ? userNames.get(userId) ?? null : null,
        status: c.status,
        resolutionReason: c.resolutionReason,
        firstResponseSec: c.qualityAudit?.firstResponseSec ?? null,
      };
    })
  );

  return {
    attendants,
    confirmations: computeConfirmationStats(appointments),
    topDoctors: computeTopDoctors(appointments.map((a) => a.doctorName)),
    kindDistribution: computeKindDistribution(
      appointments.map((a) => ({
        procedureName: a.clinicProcedure.procedure.name,
        category: a.clinicProcedure.procedure.category,
      }))
    ),
    hourlyInbound: computeHourlyInbound(inbound.map((m) => m.createdAt)),
  };
}

export async function updateAppointmentStatus(appointmentId: string, status: AppointmentStatus) {
  const { clinicId } = await requireClinicSession();
  const { status: validStatus } = updateAppointmentStatusSchema.parse({ status });

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
  if (!appointment || appointment.clinicProcedure.clinicId !== clinicId) {
    throw new Error("Agendamento não encontrado");
  }

  const isTargetConfirmedOrCompleted = validStatus === "CONFIRMED" || validStatus === "COMPLETED";
  const shouldReleaseCommission =
    isTargetConfirmedOrCompleted &&
    appointment.affiliateId &&
    appointment.affiliateCommission &&
    !appointment.commissionReleased;

  const shouldRevokeCommission =
    !isTargetConfirmedOrCompleted &&
    appointment.affiliateId &&
    appointment.affiliateCommission &&
    appointment.commissionReleased;

  let newCommissionReleased = appointment.commissionReleased;

  if (shouldReleaseCommission && appointment.affiliateId && appointment.affiliateCommission) {
    newCommissionReleased = true;
    await prisma.affiliate.update({
      where: { id: appointment.affiliateId },
      data: { totalEarned: { increment: appointment.affiliateCommission } },
    });
  } else if (shouldRevokeCommission && appointment.affiliateId && appointment.affiliateCommission) {
    newCommissionReleased = false;
    await prisma.affiliate.update({
      where: { id: appointment.affiliateId },
      data: { totalEarned: { decrement: appointment.affiliateCommission } },
    });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: validStatus,
      commissionReleased: newCommissionReleased,
    },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  // Com `await` — ver nota em appointments.ts sobre fire-and-forget não
  // sobreviver ao encerramento da função serverless na Vercel.
  try {
    await notifyAppointmentStatus(validStatus, updated);
  } catch (error) {
    console.error("Falha ao notificar mudança de status via WhatsApp:", error);
  }

  revalidatePath("/clinic/agendamentos");
  revalidatePath("/clinic");
}

/** Edição inline na tabela de /clinic/agendamentos — não existe cadastro de médico
 * no sistema, `doctorName` é texto livre digitado pela recepção (ver comentário no
 * schema). `null`/string vazia limpa o campo. */
export async function updateAppointmentDoctor(appointmentId: string, doctorName: string) {
  const { clinicId } = await requireClinicSession();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    select: { clinicProcedure: { select: { clinicId: true } } },
  });
  if (!appointment || appointment.clinicProcedure.clinicId !== clinicId) {
    throw new Error("Agendamento não encontrado");
  }

  const trimmed = doctorName.trim();
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { doctorName: trimmed || null },
  });

  revalidatePath("/clinic/agendamentos");
}

/** Nomes distintos já preenchidos em Appointment.doctorName pra essa clínica — popula
 * o seletor de médico do modal de remarcação em massa (ver reschedule-broadcast-modal). */
export async function getDistinctDoctorNames() {
  const { clinicId } = await requireClinicSession();
  const rows = await prisma.appointment.findMany({
    where: { clinicProcedure: { clinicId }, doctorName: { not: null } },
    select: { doctorName: true },
    distinct: ["doctorName"],
    orderBy: { doctorName: "asc" },
  });
  return rows.map((r) => r.doctorName!).filter(Boolean);
}

/** Pacientes agendados com um médico numa data específica — prévia do modal de
 * remarcação em massa antes de disparar o aviso. Só status ativos (PENDING/CONFIRMED),
 * não faz sentido avisar quem já foi atendido ou já cancelou. */
export async function getAppointmentsByDoctorAndDate(doctorName: string, date: Date) {
  const { clinicId } = await requireClinicSession();
  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      doctorName,
      date,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { id: true, patientName: true, patientPhone: true, timeSlot: true },
    orderBy: { timeSlot: "asc" },
  });
}

export async function listClinicProcedures() {
  const { clinicId } = await requireClinicSession();
  return prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: { procedure: true },
    orderBy: { procedure: { name: "asc" } },
  });
}

export async function listProceduresNotOffered() {
  const { clinicId } = await requireClinicSession();
  const offered = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    select: { procedureId: true },
  });
  const offeredIds = offered.map((item) => item.procedureId);
  return prisma.procedure.findMany({
    where: offeredIds.length ? { id: { notIn: offeredIds } } : undefined,
    orderBy: { name: "asc" },
  });
}

export async function updateClinicProcedure(clinicProcedureId: string, formData: FormData) {
  const { clinicId } = await requireClinicSession();
  const data = updateClinicProcedureSchema.parse({
    price: formData.get("price"),
    promotionalPrice: formData.get("promotionalPrice"),
    requiresAppointment: formData.get("requiresAppointment"),
    appointmentType: formData.get("appointmentType"),
  });

  const existing = await prisma.clinicProcedure.findUnique({ where: { id: clinicProcedureId } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Procedimento não encontrado");
  }

  await prisma.clinicProcedure.update({
    where: { id: clinicProcedureId },
    data,
  });
  revalidatePath("/clinic/precos");
}

export async function addClinicProcedure(formData: FormData) {
  const { clinicId } = await requireClinicSession();
  const data = addClinicProcedureSchema.parse({
    procedureId: formData.get("procedureId"),
    price: formData.get("price"),
    promotionalPrice: formData.get("promotionalPrice"),
    requiresAppointment: formData.get("requiresAppointment"),
    appointmentType: formData.get("appointmentType"),
  });

  await prisma.clinicProcedure.create({
    data: { clinicId, ...data },
  });
  revalidatePath("/clinic/precos");
}

const businessHoursDays = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"] as const;

export async function updateClinicBusinessHours(formData: FormData) {
  const { clinicId } = await requireClinicSession();

  const hours: Record<string, { closed?: boolean; open?: string; close?: string }> = {};
  for (const day of businessHoursDays) {
    const closed = formData.get(`${day}_closed`) === "on";
    hours[day] = closed
      ? { closed: true }
      : {
          open: String(formData.get(`${day}_open`) ?? "08:00"),
          close: String(formData.get(`${day}_close`) ?? "18:00"),
        };
  }
  const parsed: BusinessHours = businessHoursSchema.parse(hours);

  await prisma.clinic.update({
    where: { id: clinicId },
    data: { businessHours: parsed },
  });
  revalidatePath("/clinic/precos");
}
