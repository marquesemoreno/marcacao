import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/format";

type SendAttemptResult = {
  success: boolean;
  responseCode: number | null;
  error?: string;
};

const MAX_ATTEMPTS = 1;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Garante o DDI 55 (Brasil) e remove caracteres não numéricos. */
export function formatWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

export function getEvolutionConfig() {
  const apiUrl = process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || process.env.WHATSAPP_INSTANCE_NAME;
  return { apiUrl, apiKey, instanceName };
}

export function isWhatsAppConfigured(): boolean {
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  return Boolean(apiUrl && apiKey && instanceName);
}

/**
 * Serviço oficial de disparo de mensagens via Evolution API v2.
 * POST ${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}
 * Header: apikey: ${EVOLUTION_API_KEY}
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  event: string = "whatsapp.send"
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null }> {
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  const formattedNumber = formatWhatsAppNumber(to);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: {
        event,
        payload: { phone: formattedNumber, text },
        status: "SKIPPED",
        responseCode: null,
      },
    });
    return { success: false, skipped: true };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/message/sendText/${instanceName}`;

  let result: SendAttemptResult = { success: false, responseCode: null };
  let attempts = 0;

  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: apiKey,
        },
        body: JSON.stringify({
          number: formattedNumber,
          text,
        }),
        signal: AbortSignal.timeout(5000),
      });

      result = { success: response.ok, responseCode: response.status };
      if (response.ok) break;
    } catch (error) {
      result = {
        success: false,
        responseCode: null,
        error: error instanceof Error ? error.message : "Erro na conexão com Evolution API",
      };
    }

    if (attempts < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempts);
    }
  }

  await prisma.webhookLog.create({
    data: {
      event,
      payload: {
        provider: "evolution_v2",
        phone: formattedNumber,
        text,
        attempts,
        error: result.error ?? null,
      },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode };
}

export type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { clinicProcedure: { include: { clinic: true; procedure: true } } };
}>;

function formatDateBR(date: Date): string {
  const d = new Date(date);
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Dispara a mensagem oficial de confirmação de agendamento via WhatsApp
 */
export async function sendAppointmentConfirmation(appointment: AppointmentWithRelations) {
  const patientName = appointment.patientName.trim();
  const procedureName = appointment.clinicProcedure.procedure.name;
  const clinicName = appointment.clinicProcedure.clinic.tradeName;
  const dateFormatted = formatDateBR(appointment.date);
  const timeFormatted = appointment.timeSlot ? ` às ${appointment.timeSlot}` : "";
  const preparation =
    appointment.clinicProcedure.procedure.preparationInstructions?.trim() ||
    "Comparecer 15 minutos antes com documento oficial com foto e cartão do SUS ou CPF.";
  const comprovanteUrl = `${getBaseUrl()}/comprovante/${appointment.id}`;

  const messageText = `Olá ${patientName}! 👋 Seu agendamento para ${procedureName} na ${clinicName} foi registrado para ${dateFormatted}${timeFormatted}.

📋 Orientações: ${preparation}

🎟️ Sua Guia Oficial com QR Code: ${comprovanteUrl}`;

  return sendWhatsAppMessage(appointment.patientPhone, messageText, "appointment.confirmation");
}

/**
 * Dispara o lembrete interativo D-1 com opções (1 para confirmar, 2 para cancelar)
 */
export async function sendReminderD1(appointment: AppointmentWithRelations) {
  const patientName = appointment.patientName.trim();
  const procedureName = appointment.clinicProcedure.procedure.name;
  const clinicName = appointment.clinicProcedure.clinic.tradeName;
  const dateFormatted = formatDateBR(appointment.date);
  const timeFormatted = appointment.timeSlot ? ` às ${appointment.timeSlot}` : "";
  const preparation =
    appointment.clinicProcedure.procedure.preparationInstructions?.trim() ||
    "Comparecer 15 minutos antes com documento oficial com foto.";

  const messageText = `Olá ${patientName}! 👋 Lembrando da sua consulta/exame em ${dateFormatted}${timeFormatted} na ${clinicName} (${procedureName}).
📋 Orientações: ${preparation}

Por favor, responda com uma das opções abaixo:
1️⃣ Digite 1 para Confirmar presença
2️⃣ Digite 2 para Cancelar`;

  return sendWhatsAppMessage(appointment.patientPhone, messageText, "appointment.reminder_d1");
}

/* Compatibilidade com código legado e Server Actions */
export const whatsappService = {
  sendMessage: (phone: string, text: string, event: string) => sendWhatsAppMessage(phone, text, event),
  isConfigured: () => isWhatsAppConfigured(),
};

export async function notifyAppointmentStatus(status: AppointmentStatus, appointment: AppointmentWithRelations) {
  if (status === "PENDING" || status === "CONFIRMED") {
    return sendAppointmentConfirmation(appointment);
  }
  const statusLabel = status === "CANCELLED" ? "Cancelado" : "Atualizado";
  const messageText = `Olá ${appointment.patientName}! Seu agendamento para ${appointment.clinicProcedure.procedure.name} na ${appointment.clinicProcedure.clinic.tradeName} teve o status alterado para: *${statusLabel}*.`;
  return sendWhatsAppMessage(appointment.patientPhone, messageText, `appointment.${status.toLowerCase()}`);
}
