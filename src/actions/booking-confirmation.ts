"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { buildBookingConfirmation } from "@/lib/booking-confirmation";
import { sendMessage } from "@/actions/inbox";

/** Envia ao paciente a confirmação do agendamento recém-criado pela ponte (Etapa 2.4).
 * Agendamento do catálogo já manda a própria confirmação em createAppointment — aqui só
 * os da ponte (Santa Clara, Urolaser), que antes viravam só nota interna. */
export async function sendBookingConfirmation(
  conversationId: string,
  data: {
    patientName: string;
    procedure: string;
    doctorName?: string | null;
    date: string;
    time?: string | null;
    arrivalOrder?: boolean;
    price?: number | null;
  },
) {
  const { clinicId } = await requireClinicSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true, clinic: { select: { tradeName: true, address: true, neighborhood: true, city: true } } },
  });
  if (!conversation || conversation.clinicId !== clinicId) throw new Error("Conversa não encontrada");
  const c = conversation.clinic;
  const address = [c.address, c.neighborhood].filter(Boolean).join(" - ") + (c.city ? `, ${c.city}` : "");
  const text = buildBookingConfirmation({
    patientName: data.patientName,
    procedure: data.procedure,
    doctor: data.doctorName,
    date: data.date,
    time: data.time,
    arrivalOrder: !!data.arrivalOrder,
    price: data.price,
    clinicName: c.tradeName,
    address: c.address && c.address !== "Uso interno" ? address : null,
  });
  await sendMessage(conversationId, text);
  return text;
}
