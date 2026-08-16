"use server";

import { prisma } from "@/lib/prisma";
import { createAppointmentSchema, type CreateAppointmentInput } from "@/lib/schemas/appointment";
import { notifyAppointmentStatus } from "@/lib/whatsapp";
import { toPlainAppointment } from "@/lib/serialize";

export async function listUpcomingAppointments(clinicId: string) {
  const today = new Date();
  const startOfToday = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())
  );

  return prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      date: { gte: startOfToday },
    },
    orderBy: { date: "asc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}

export async function createAppointment(input: CreateAppointmentInput) {
  const data = createAppointmentSchema.parse(input);

  const appointment = await prisma.appointment.create({
    data: {
      patientName: data.patientName,
      patientCpf: data.patientCpf,
      patientPhone: data.patientPhone,
      clinicProcedureId: data.clinicProcedureId,
      date: new Date(`${data.date}T00:00:00Z`),
      timeSlot: data.timeSlot || null,
      notes: data.notes || null,
    },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  // Dispara sem `await`: não faz sentido segurar a confirmação de agendamento
  // (fluxo público, de alta conversão) esperando o WhatsApp responder.
  notifyAppointmentStatus("PENDING", appointment).catch((error) => {
    console.error("Falha ao notificar novo agendamento via WhatsApp:", error);
  });

  // Serializado (Decimal -> number) porque esta action é chamada direto de
  // Client Components (BookingDialog, CreateAppointmentShortcut do inbox) —
  // o valor de retorno cruza a fronteira Server->Client igual a props de
  // Server Component, e Decimal não é um tipo serializável nela.
  return toPlainAppointment(appointment);
}

export async function getAppointmentById(id: string) {
  return prisma.appointment.findUnique({
    where: { id },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });
}
