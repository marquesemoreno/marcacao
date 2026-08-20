"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";

function formatDatePtBR(date: Date): string {
  return new Date(date).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function sendAppointmentReminder(appointmentId: string) {
  const { clinicId, userId } = await requireClinicSession();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      clinicProcedure: {
        include: {
          clinic: true,
          procedure: {
            include: {
              specialty: true,
            },
          },
        },
      },
    },
  });

  if (!appointment || appointment.clinicProcedure.clinicId !== clinicId) {
    return { success: false, message: "Agendamento não encontrado." };
  }

  const { patientName, patientPhone, date, timeSlot, clinicProcedure } = appointment;
  const clinic = clinicProcedure.clinic;
  const procedureName = clinicProcedure.procedure.name;
  const specialtyName = clinicProcedure.procedure.specialty?.name || "Geral";
  const formattedDate = formatDatePtBR(date);
  const timeText = timeSlot || "Horário agendado";

  const textContent = `📱 *LEMBRETE DE CONSULTA / EXAME*

Olá *${patientName}*! Lembramos que o seu agendamento de saúde está confirmado:

🏥 *Clínica:* ${clinic.tradeName || clinic.name}
🩺 *Procedimento:* ${procedureName} (${specialtyName})
📅 *Data:* ${formattedDate} às ${timeText}
📍 *Endereço:* ${clinic.address || "Vitória da Conquista - BA"}

Por favor, confirme sua presença ou avise caso precise reagendar:
1️⃣ Digite *1* para ✅ *Confirmar Presença*
2️⃣ Digite *2* para 🔄 *Solicitar Reagendamento*`;

  // Localiza ou cria o Contato e Conversa no Supabase para espelhar a mensagem no Chat
  let contact = await prisma.contact.findFirst({
    where: { phone: patientPhone },
  });

  if (!contact) {
    contact = await prisma.contact.create({
      data: {
        name: patientName,
        phone: patientPhone,
        cpf: appointment.patientCpf,
      },
    });
  }

  let conversation = await prisma.conversation.findFirst({
    where: {
      clinicId,
      contactId: contact.id,
    },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        clinicId,
        contactId: contact.id,
        status: "OPEN",
        tags: ["⚡ Prioritário", "✅ Agendado"],
      },
    });
  }

  // Registra a mensagem enviada no histórico do Chat
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: "OUTBOUND",
      type: "TEXT",
      content: textContent,
      status: "SENT",
      senderUserId: userId,
    },
  });

  // Atualiza o agendamento com os dados do disparo do lembrete
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      reminderSentAt: new Date(),
      reminderStatus: "SENT",
    },
  });

  revalidatePath("/clinic/agendamentos");
  revalidatePath("/clinic/inbox");
  revalidatePath("/admin/inbox");

  return {
    success: true,
    message: `Lembrete de consulta enviado com sucesso para ${patientName} via WhatsApp!`,
  };
}

export async function confirmAppointmentStatus(
  appointmentId: string,
  newStatus: "CONFIRMED" | "RESCHEDULE_REQUESTED"
) {
  const { clinicId, userId } = await requireClinicSession();

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      clinicProcedure: { select: { clinicId: true } },
    },
  });

  if (!appointment || appointment.clinicProcedure.clinicId !== clinicId) {
    return { success: false, message: "Agendamento não encontrado." };
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: newStatus === "CONFIRMED" ? "CONFIRMED" : "PENDING",
      reminderStatus: newStatus,
    },
  });

  // Registra a nota interna no Chat
  const contact = await prisma.contact.findFirst({
    where: { phone: appointment.patientPhone },
  });

  if (contact) {
    const conversation = await prisma.conversation.findFirst({
      where: { clinicId, contactId: contact.id },
    });

    if (conversation) {
      const noteText =
        newStatus === "CONFIRMED"
          ? `✅ Consulta confirmada pelo paciente via WhatsApp (${formatDatePtBR(appointment.date)} às ${appointment.timeSlot || "08:00"})`
          : `🔄 Paciente solicitou reagendamento da consulta (${formatDatePtBR(appointment.date)})`;

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          type: "INTERNAL_NOTE",
          content: noteText,
          status: "SENT",
          senderUserId: userId,
        },
      });
    }
  }

  revalidatePath("/clinic/agendamentos");
  revalidatePath("/clinic/inbox");
  revalidatePath("/admin/inbox");

  return { success: true };
}

export async function sendBatchReminders() {
  const { clinicId } = await requireClinicSession();

  // Busca agendamentos pendentes de lembrete para hoje ou datas futuras
  const appointments = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      status: { in: ["PENDING", "CONFIRMED"] },
      reminderStatus: { notIn: ["SENT", "CONFIRMED"] },
    },
    take: 10,
  });

  let sentCount = 0;
  for (const app of appointments) {
    const result = await sendAppointmentReminder(app.id);
    if (result.success) sentCount++;
  }

  revalidatePath("/clinic/agendamentos");
  return { success: true, count: sentCount };
}
