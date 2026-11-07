import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/request-auth";
import { isClinicOpenAt, shouldAssistDuringHours } from "@/lib/after-hours-booking";
import { afterHoursDialogInProgress, replyAfterHoursBooking } from "@/lib/after-hours-booking-server";

export const maxDuration = 120;

/** Nível 1 do 4.1 (07/11/2026): no horário comercial, pedido de marcação que ficou 5 min sem
 * resposta da equipe → a IA adianta o pedido (o quê / quando) e avisa que a recepção confirma.
 * Daí em diante o diálogo segue pela mensagem do paciente (patient-intent-server) até alguém
 * da equipe responder. A cada 5 minutos. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const now = new Date();
  const requests = await prisma.bookingRequest.findMany({
    where: { status: "OPEN", updatedAt: { gte: new Date(now.getTime() - 2 * 3_600_000) } },
    orderBy: { updatedAt: "asc" },
    take: 50,
  });
  if (!requests.length) return NextResponse.json({ ok: true, replied: 0 });

  const clinics = await prisma.clinic.findMany({
    where: { id: { in: [...new Set(requests.map((r) => r.clinicId))] }, bookingAssistEnabled: true },
    select: { id: true, businessHours: true },
  });
  const openClinics = new Set(
    clinics
      .filter((c) => isClinicOpenAt(c.businessHours as Record<string, { open?: string; close?: string; closed?: boolean }> | null, now))
      .map((c) => c.id),
  );

  let replied = 0;
  for (const r of requests) {
    if (!openClinics.has(r.clinicId)) continue;
    if (await afterHoursDialogInProgress(r.conversationId)) continue; // já está conversando
    const [last, human] = await Promise.all([
      prisma.message.findFirst({
        where: { conversationId: r.conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        select: { direction: true, createdAt: true },
      }),
      prisma.message.findFirst({
        where: { conversationId: r.conversationId, direction: "OUTBOUND", senderUserId: { not: null }, createdAt: { gte: r.createdAt } },
        select: { id: true },
      }),
    ]);
    if (
      !shouldAssistDuringHours({
        minutesSinceLastInbound: last ? (now.getTime() - last.createdAt.getTime()) / 60_000 : 0,
        lastDirection: last?.direction ?? null,
        humanReplied: !!human,
      })
    )
      continue;
    await replyAfterHoursBooking(r.conversationId, r, "cron");
    replied++;
  }
  return NextResponse.json({ ok: true, replied });
}
