"use server";

import { prisma } from "@/lib/prisma";

export async function listUpcomingAppointments(clinicId: string) {
  return prisma.appointment.findMany({
    where: { clinicId, scheduledAt: { gte: new Date() } },
    orderBy: { scheduledAt: "asc" },
    include: { patient: true, doctor: true, service: true },
  });
}
