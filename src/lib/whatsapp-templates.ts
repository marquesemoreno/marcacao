import type { AppointmentStatus } from "@prisma/client";
import { formatDate, getBaseUrl } from "@/lib/format";

export type AppointmentNotificationData = {
  id: string;
  patientName: string;
  patientPhone: string;
  date: Date;
  timeSlot: string | null;
  notes: string | null;
  clinic: {
    tradeName: string;
    address: string;
    neighborhood: string;
    city: string;
  };
  procedure: {
    name: string;
    preparationInstructions: string | null;
  };
};

function summaryLines(data: AppointmentNotificationData) {
  const when = data.timeSlot ? `${formatDate(data.date)} às ${data.timeSlot}` : formatDate(data.date);
  return [
    `📋 *${data.procedure.name}*`,
    `🏥 ${data.clinic.tradeName}`,
    `📍 ${data.clinic.address}, ${data.clinic.neighborhood}, ${data.clinic.city}`,
    `📅 ${when}`,
  ].join("\n");
}

function trackingLine(data: AppointmentNotificationData) {
  return `Acompanhe pelo link: ${getBaseUrl()}/acompanhar/${data.id}`;
}

function newAppointmentMessage(data: AppointmentNotificationData) {
  return [
    `Olá, ${data.patientName}! 👋`,
    "",
    "Recebemos sua solicitação de agendamento:",
    "",
    summaryLines(data),
    "",
    "A clínica ainda vai *confirmar* seu horário — avisamos assim que isso acontecer.",
    "",
    trackingLine(data),
  ].join("\n");
}

function confirmedAppointmentMessage(data: AppointmentNotificationData) {
  const lines = [
    "✅ Seu agendamento foi *confirmado*!",
    "",
    summaryLines(data),
  ];

  if (data.procedure.preparationInstructions) {
    lines.push("", "⚠️ *Instruções de preparo:*", data.procedure.preparationInstructions);
  }

  lines.push(
    "",
    "Responda esta mensagem para confirmar sua presença:",
    "*1* ou *SIM* — Confirmo presença",
    "*2* ou *CANCELAR* — Preciso cancelar",
    "",
    trackingLine(data)
  );

  return lines.join("\n");
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** Cancelou ou faltou: em vez de mandar o paciente refazer a busca no site, convida a
 * remarcar respondendo no próprio WhatsApp — a conversa volta pra fila da recepção
 * (ver reopenForRebooking em src/actions/clinic.ts). */
const REBOOK_INVITE = "Quer um novo horário? Responda esta mensagem e nossa equipe encontra a melhor data pra você. 😊";

function cancelledAppointmentMessage(data: AppointmentNotificationData) {
  return [
    `❌ ${firstName(data.patientName)}, seu agendamento foi *cancelado*.`,
    "",
    summaryLines(data),
    "",
    REBOOK_INVITE,
  ].join("\n");
}

function completedAppointmentMessage(data: AppointmentNotificationData) {
  return [
    `✅ Atendimento concluído! Obrigado por escolher *${data.clinic.tradeName}*.`,
    "",
    summaryLines(data),
  ].join("\n");
}

function noShowAppointmentMessage(data: AppointmentNotificationData) {
  return [
    "⚠️ Não identificamos seu comparecimento ao agendamento abaixo:",
    "",
    summaryLines(data),
    "",
    "Se foi um engano ou imprevisto, tudo bem! " + REBOOK_INVITE,
  ].join("\n");
}

/** Monta o texto certo pro novo status. `null` = esse status não gera notificação. */
export function buildAppointmentMessage(
  status: AppointmentStatus,
  data: AppointmentNotificationData
): string | null {
  switch (status) {
    case "PENDING":
      return newAppointmentMessage(data);
    case "CONFIRMED":
      return confirmedAppointmentMessage(data);
    case "CANCELLED":
      return cancelledAppointmentMessage(data);
    case "COMPLETED":
      return completedAppointmentMessage(data);
    case "NO_SHOW":
      return noShowAppointmentMessage(data);
  }
}
