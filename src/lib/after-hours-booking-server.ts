import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/whatsapp";
import { recordAudit } from "@/lib/audit-server";
import { bookingSummary } from "@/lib/booking-request";
import type { SavedBookingRequest } from "@/lib/booking-request-server";
import {
  AFTER_HOURS_MAX_REPLIES,
  afterHoursBookingReply,
  isClinicOpenAt,
  missingBookingField,
  nextOpening,
} from "@/lib/after-hours-booking";

const ACTION = "after_hours_booking.reply";
const WINDOW_MS = 14 * 3_600_000;

/** Há uma conversa de marcação noturna em andamento (pra seguir mesmo quando a resposta
 * do paciente, tipo "de manhã", não é classificada sozinha como "quer agendar"). */
export async function afterHoursDialogInProgress(conversationId: string): Promise<boolean> {
  const last = await prisma.auditLog.findFirst({
    where: { action: ACTION, entity: "Conversation", entityId: conversationId, createdAt: { gte: new Date(Date.now() - WINDOW_MS) } },
    orderBy: { createdAt: "desc" },
    select: { changes: true },
  });
  return !!last && !JSON.stringify(last.changes).includes('"done"');
}

/** Com a clínica fechada e a opção ligada, responde ao paciente pedindo o que falta do pedido
 * de marcação ou confirmando o pedido completo. Nunca lança; nunca promete horário. */
/** trigger "cron": horário comercial, pedido parado há 5 min (src/app/api/cron/booking-assist).
 * trigger "message": nova mensagem do paciente — de dia só segue um diálogo já começado. */
export async function replyAfterHoursBooking(
  conversationId: string,
  request: SavedBookingRequest,
  trigger: "message" | "cron" = "message",
): Promise<void> {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: {
        clinicId: true,
        channel: true,
        aiEnabled: true,
        contact: { select: { name: true, phone: true } },
        clinic: { select: { afterHoursBookingEnabled: true, bookingAssistEnabled: true, businessHours: true } },
      },
    });
    if (!conversation?.clinic) return;
    if (conversation.channel !== "WHATSAPP" || !conversation.contact.phone) return;
    // O atendente de IA (com consentimento) já conversa sozinho; não falar por cima dele.
    if (conversation.aiEnabled) return;
    const now = new Date();
    const hours = conversation.clinic.businessHours as Record<string, { open?: string; close?: string; closed?: boolean }> | null;
    const open = isClinicOpenAt(hours, now);
    if (!open && !conversation.clinic.afterHoursBookingEnabled) return;
    if (open) {
      if (!conversation.clinic.bookingAssistEnabled) return;
      if (trigger === "message" && !(await afterHoursDialogInProgress(conversationId))) return;
    }

    const since = new Date(now.getTime() - WINDOW_MS);
    // Alguém da equipe respondeu há pouco (plantão, celular): deixa com a pessoa.
    const humanReply = await prisma.message.findFirst({
      where: { conversationId, direction: "OUTBOUND", senderUserId: { not: null }, createdAt: { gte: since } },
      select: { id: true },
    });
    if (humanReply) return;

    const previous = await prisma.auditLog.findMany({
      where: { action: ACTION, entity: "Conversation", entityId: conversationId, createdAt: { gte: since } },
      select: { changes: true },
    });
    if (previous.length >= AFTER_HOURS_MAX_REPLIES) return;

    const missing = missingBookingField(request);
    const summary = bookingSummary(request);
    // Pedido completo já confirmado com o mesmo resumo: não repete.
    if (!missing && previous.some((p) => JSON.stringify(p.changes).includes(JSON.stringify(summary)))) return;

    const text = afterHoursBookingReply({
      missing,
      name: conversation.contact.name,
      opening: nextOpening(hours, now),
      summary,
      mode: open ? "open" : "closed",
    });
    const result = await sendWhatsAppMessage(conversation.contact.phone, text, ACTION, conversation.clinicId);
    await prisma.message.create({
      data: { conversationId, direction: "OUTBOUND", content: text, status: result.success ? "DELIVERED" : "FAILED" },
    });
    await recordAudit({
      clinicId: conversation.clinicId,
      userId: null,
      action: ACTION,
      entity: "Conversation",
      entityId: conversationId,
      before: null,
      after: { step: missing ?? "done", summary },
    });
  } catch (error) {
    console.error("[marcação fora do horário] falha:", error);
  }
}
