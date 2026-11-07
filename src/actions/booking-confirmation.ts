"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { buildBookingConfirmation } from "@/lib/booking-confirmation";
import { createContact, sendMessage } from "@/actions/inbox";
import { formatToWhatsAppNumber, toggleNinthDigit } from "@/lib/whatsapp";

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

/** Agendamento pela grade da Agenda: não há conversa aberta — acha o contato pelo telefone
 * (com e sem o 9º dígito, pra não duplicar) ou cria, e manda a mesma confirmação. */
export async function sendBookingConfirmationToPhone(
  phone: string,
  data: Parameters<typeof sendBookingConfirmation>[1],
) {
  const { clinicId } = await requireClinicSession();
  const full = formatToWhatsAppNumber(phone);
  const alt = toggleNinthDigit(full);
  const contact = await prisma.contact.findFirst({
    where: { phone: { in: alt ? [full, alt] : [full] } },
    select: { id: true, conversations: { where: { clinicId }, select: { id: true }, take: 1 } },
  });
  const conversationId = contact?.conversations[0]?.id ?? (await createContact(data.patientName || "Paciente", full));
  return sendBookingConfirmation(conversationId, data);
}
