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
  return prisma.clinic.findUniqueOrThrow({ where: { id: clinicId } });
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

  notifyAppointmentStatus(validStatus, updated).catch((error) => {
    console.error("Falha ao notificar mudança de status via WhatsApp:", error);
  });

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
