"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { periodWindow, type PeriodKey } from "@/lib/report-period";
import { summarizeSlotRecovery } from "@/lib/slot-recovery";

/** Relatório: vagas de cancelamento/falta que voltaram a ser ocupadas pela lista de espera. */
export async function getSlotRecoveryReport(period: PeriodKey = "30") {
  const { clinicId } = await requireClinicPermission("relatorios");
  const { since, until } = periodWindow(period, false);
  const range = { gte: since, lt: until ?? new Date() };
  const [offers, waiting, booked, clinic] = await Promise.all([
    prisma.slotOffer.findMany({ where: { clinicId, createdAt: range }, select: { status: true, entryId: true } }),
    prisma.waitlistEntry.count({ where: { clinicId, status: "WAITING" } }),
    prisma.waitlistEntry.findMany({ where: { clinicId, status: "BOOKED", updatedAt: range }, select: { id: true } }),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { defaultTicket: true } }),
  ]);
  const viaOffer = new Set(offers.filter((o) => o.status === "FILLED").map((o) => o.entryId));
  const bookedManually = booked.filter((b) => !viaOffer.has(b.id)).length;
  const ticket = clinic?.defaultTicket != null ? Number(clinic.defaultTicket) : null;
  return summarizeSlotRecovery(offers, { waiting, bookedManually }, ticket);
}
