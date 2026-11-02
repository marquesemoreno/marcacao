"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit-server";
import { notifyAgenda } from "@/lib/realtime-server";
import { bookingSummary } from "@/lib/booking-request";

/** Pedidos de marcação abertos (Agenda). Tabela nova: sem migration aplicada, lista vazia. */
export async function listOpenBookingRequests() {
  const { clinicId } = await requireClinicSession();
  const rows = await prisma.bookingRequest
    .findMany({ where: { clinicId, status: "OPEN" }, orderBy: { createdAt: "asc" }, take: 50 })
    .catch(() => []);
  return rows.map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    patientName: r.patientName,
    phone: r.phone,
    summary: bookingSummary(r),
    notes: r.notes,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function resolveBookingRequest(id: string, status: "SCHEDULED" | "DISCARDED" | "OPEN") {
  const { clinicId, userId } = await requireClinicSession();
  if (!["SCHEDULED", "DISCARDED", "OPEN"].includes(status)) throw new Error("Status inválido.");
  const done = status !== "OPEN";
  const { count } = await prisma.bookingRequest.updateMany({
    where: { id, clinicId },
    data: { status, handledByUserId: done ? userId : null, handledAt: done ? new Date() : null },
  });
  if (count === 0) throw new Error("Pedido não encontrado.");
  await recordAudit({ clinicId, userId, action: "booking.status", entity: "booking_request", entityId: id, before: null, after: { status } });
  await notifyAgenda(clinicId);
  return { success: true as const };
}
