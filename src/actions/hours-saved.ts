"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { periodWindow, type PeriodKey } from "@/lib/report-period";
import { summarizeHoursSaved, type HoursSavedSummary } from "@/lib/hours-saved";

/** Relatório: mensagens que o sistema enviou sozinho no período, convertidas em horas de recepção. */
export async function getHoursSavedReport(period: PeriodKey = "30"): Promise<HoursSavedSummary> {
  const { clinicId } = await requireClinicPermission("relatorios");
  const { since, until } = periodWindow(period, false);
  const rows = await prisma.message.findMany({
    where: {
      direction: "OUTBOUND",
      senderUserId: null,
      sentFromDevice: false,
      type: { not: "INTERNAL_NOTE" },
      createdAt: { gte: since, lt: until ?? new Date() },
      conversation: { clinicId },
    },
    select: { content: true },
  });
  return summarizeHoursSaved(rows.map((r) => r.content));
}
