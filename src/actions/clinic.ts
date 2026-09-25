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

/** Relatório de atendimento/chat da clínica (ver /clinic/relatorio) — mesma lógica de
 * getAttendantPerformanceReport/getConversationQualityReport (admin.ts), só que filtrada
 * por clinicId em vez da plataforma inteira. Duplicado de propósito (mesmo padrão
 * clínica/admin usado no resto do projeto) em vez de generalizar as funções do admin. */
export async function getClinicChatReport(days: number = 30) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const [conversations, audits, urgencyCount] = await Promise.all([
    prisma.conversation.findMany({
      where: { clinicId, createdAt: { gte: since } },
      select: { id: true, status: true, resolutionReason: true, createdAt: true, resolvedAt: true },
    }),
    prisma.conversationQualityAudit.findMany({
      where: { conversation: { clinicId }, createdAt: { gte: since } },
      select: { sentiment: true, firstResponseSec: true, resolutionSec: true },
    }),
    prisma.messageTriage.count({
      where: { conversation: { clinicId }, createdAt: { gte: since } },
    }),
  ]);

  const totalResolved = conversations.filter((c) => c.status === "RESOLVED").length;
  const totalAgendados = conversations.filter((c) => c.resolutionReason === "AGENDAMENTO_CONCLUIDO").length;
  const conversionRate = totalResolved > 0 ? Math.round((totalAgendados / totalResolved) * 1000) / 10 : 0;

  const withFrt = audits.filter((a) => a.firstResponseSec !== null);
  const withTtr = audits.filter((a) => a.resolutionSec !== null);
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
    urgencyCount,
  };
}

/** Relatório de agendamentos da clínica (ver /clinic/relatorio) — mesma fonte de valor
 * (clinicProcedure.price/promotionalPrice) já usada em getFinancialReport (admin.ts). */
export async function getClinicAppointmentsReport(days: number = 30) {
  const { clinicId } = await requireClinicSession();
  const since = addUTCDays(startOfUTCDay(new Date()), -days);

  const appointments = await prisma.appointment.findMany({
    where: { clinicProcedure: { clinicId }, createdAt: { gte: since } },
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
