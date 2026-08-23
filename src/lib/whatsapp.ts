import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/format";

type SendAttemptResult = {
  success: boolean;
  responseCode: number | null;
  error?: string;
  keyId?: string;
};

/** Extrai o key.id (Baileys) da resposta do sendText/sendMedia — usado depois pra
 * casar os acks de entrega/leitura (webhook "messages.update") com a mensagem. */
async function extractKeyId(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json();
    const id = body?.key?.id;
    return typeof id === "string" ? id : undefined;
  } catch {
    return undefined;
  }
}

const MAX_ATTEMPTS = 1;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Formatador rigoroso de telefone brasileiro com DDI 55 */
export function formatToWhatsAppNumber(phone: string): string {
  let digits = phone.replace(/@s\.whatsapp\.net|@c\.us/g, '').replace(/\D/g, '');
  
  // Corrige números que vieram com apenas um 5 no início (ex: 57788411342 -> 557788411342)
  if (digits.length === 11 && digits.startsWith('577')) {
    digits = '55' + digits.substring(1);
  } else if (digits.length === 12 && digits.startsWith('577')) {
    digits = '55' + digits.substring(1);
  }
  // Se veio sem DDI 55 (ex: 77988411342 ou 7788411342), adiciona 55
  else if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = '55' + digits;
  }
  
  return digits;
}

export function formatWhatsAppNumber(phone: string): string {
  return formatToWhatsAppNumber(phone);
}

function getGlobalEvolutionConfig() {
  const apiUrl = process.env.EVOLUTION_API_URL || process.env.WHATSAPP_API_URL || "https://evolution.tivdc.com.br";
  const apiKey = process.env.EVOLUTION_API_KEY || process.env.WHATSAPP_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME || process.env.WHATSAPP_INSTANCE_NAME || "TIVDC";
  return { apiUrl, apiKey, instanceName };
}

/**
 * Resolve a config da Evolution API a usar: se `clinicId` tiver uma instância própria
 * cadastrada (ver WhatsappInstance / painel admin), usa ela — canal exclusivo daquela
 * clínica. Sem `clinicId`, ou se a clínica não tiver instância própria, cai na instância
 * global (env vars) — comportamento idêntico ao de antes desse recurso existir.
 */
export async function getEvolutionConfig(clinicId?: string) {
  if (clinicId) {
    const dedicated = await prisma.whatsappInstance.findUnique({ where: { clinicId } });
    if (dedicated) {
      return { apiUrl: dedicated.apiUrl, apiKey: dedicated.apiKey, instanceName: dedicated.instanceName };
    }
  }
  return getGlobalEvolutionConfig();
}

export function isWhatsAppConfigured(): boolean {
  const { apiUrl, apiKey, instanceName } = getGlobalEvolutionConfig();
  return Boolean(apiUrl && apiKey && instanceName);
}

/**
 * Serviço oficial de disparo de mensagens via Evolution API v2.
 * POST ${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE_NAME}
 * Headers: { "apikey": EVOLUTION_API_KEY, "Content-Type": "application/json" }
 * Payload: { "number": formatToWhatsAppNumber(to), "text": message }
 */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  event: string = "whatsapp.send",
  clinicId?: string
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null; keyId?: string }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  const target = formatToWhatsAppNumber(to);
  console.log('[WhatsApp Envio] Disparando para:', target);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: {
        event,
        payload: { phone: target, text },
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
          number: target,
          text,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const keyId = response.ok ? await extractKeyId(response) : undefined;
      result = { success: response.ok, responseCode: response.status, keyId };
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
        phone: target,
        text,
        attempts,
        error: result.error ?? null,
      },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode, keyId: result.keyId };
}

/**
 * Envio de mídia (imagem/documento) via Evolution API v2.
 * POST ${EVOLUTION_API_URL}/message/sendMedia/${EVOLUTION_INSTANCE_NAME}
 * `media` é uma URL (a assinada do Supabase Storage) — a Evolution API busca
 * o arquivo nela, não precisa reenviar o base64 pra ela.
 */
export async function sendWhatsAppMedia(
  to: string,
  mediaUrl: string,
  mimeType: string,
  fileName: string,
  caption: string,
  event: string = "whatsapp.send_media",
  clinicId?: string
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null; keyId?: string }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  const target = formatToWhatsAppNumber(to);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: {
        event,
        payload: { phone: target, fileName },
        status: "SKIPPED",
        responseCode: null,
      },
    });
    return { success: false, skipped: true };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/message/sendMedia/${instanceName}`;
  const mediatype = mimeType.startsWith("image/") ? "image" : "document";

  let result: SendAttemptResult = { success: false, responseCode: null };

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: target,
        mediatype,
        mimetype: mimeType,
        caption,
        media: mediaUrl,
        fileName,
      }),
      signal: AbortSignal.timeout(15000),
    });
    const keyId = response.ok ? await extractKeyId(response) : undefined;
    result = { success: response.ok, responseCode: response.status, keyId };
  } catch (error) {
    result = {
      success: false,
      responseCode: null,
      error: error instanceof Error ? error.message : "Erro na conexão com Evolution API",
    };
  }

  await prisma.webhookLog.create({
    data: {
      event,
      payload: { provider: "evolution_v2", phone: target, fileName, mediatype, error: result.error ?? null },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode, keyId: result.keyId };
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
  sendMessage: (phone: string, text: string, event: string, clinicId?: string) =>
    sendWhatsAppMessage(phone, text, event, clinicId),
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
