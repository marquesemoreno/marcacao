"use server";

import { prisma } from "@/lib/prisma";

export async function listUpcomingAppointments(clinicId: string) {
  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      date: { gte: new Date() },
    },
    orderBy: { date: "asc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}
