import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { buildAppointmentMessage, type AppointmentNotificationData } from "@/lib/whatsapp-templates";

type WhatsAppProvider = "evolution" | "uazapi" | "zapi";

type ProviderRequest = {
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
};

type SendAttemptResult = {
  success: boolean;
  responseCode: number | null;
  error?: string;
};

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Garante o DDI 55 (Brasil) — o resto do app guarda telefone só com DDD+número. */
function toWhatsAppNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  return `55${digits}`;
}

/**
 * Cada provedor tem um formato de requisição diferente de verdade (endpoint, header
 * de autenticação, nomes de campo). Em vez de fingir uma API única "compatível com
 * todos", cada um tem seu próprio builder — trocar de provedor é só mudar
 * WHATSAPP_PROVIDER, o resto do serviço (retry, log) é compartilhado.
 */
function buildProviderRequest(
  provider: WhatsAppProvider,
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  phone: string,
  text: string
): ProviderRequest {
  const number = toWhatsAppNumber(phone);
  const baseUrl = apiUrl.replace(/\/$/, "");

  switch (provider) {
    case "evolution":
      // https://doc.evolution-api.com/ — POST /message/sendText/{instance}
      return {
        url: `${baseUrl}/message/sendText/${instanceName}`,
        headers: { "Content-Type": "application/json", apikey: apiKey },
        body: { number, text },
      };
    case "uazapi":
      // https://uazapi.com/ — POST /send/text (token no header, instância no corpo)
      return {
        url: `${baseUrl}/send/text`,
        headers: { "Content-Type": "application/json", token: apiKey },
        body: { number, text, instance: instanceName },
      };
    case "zapi":
      // https://developer.z-api.io/ — instância e token vão na própria URL
      return {
        url: `${baseUrl}/instances/${instanceName}/token/${apiKey}/send-text`,
        headers: { "Content-Type": "application/json" },
        body: { phone: number, message: text },
      };
  }
}

class WhatsAppService {
  private get apiUrl() {
    return process.env.WHATSAPP_API_URL;
  }
  private get apiKey() {
    return process.env.WHATSAPP_API_KEY;
  }
  private get instanceName() {
    return process.env.WHATSAPP_INSTANCE_NAME;
  }
  private get provider(): WhatsAppProvider {
    const configured = process.env.WHATSAPP_PROVIDER;
    if (configured === "uazapi" || configured === "zapi") return configured;
    return "evolution";
  }

  isConfigured(): boolean {
    return Boolean(this.apiUrl && this.apiKey && this.instanceName);
  }

  private async attemptSend(request: ProviderRequest): Promise<SendAttemptResult> {
    try {
      const response = await fetch(request.url, {
        method: "POST",
        headers: request.headers,
        body: JSON.stringify(request.body),
      });
      return { success: response.ok, responseCode: response.status };
    } catch (error) {
      return {
        success: false,
        responseCode: null,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      };
    }
  }

  /**
   * Envia uma mensagem de texto, com retentativas (backoff simples) e log em
   * WebhookLog independente do resultado. Nunca lança — quem chama não precisa
   * de try/catch, só decidir se espera (`await`) ou dispara e esquece.
   */
  async sendMessage(
    phone: string,
    text: string,
    event: string
  ): Promise<{ success: boolean; skipped: boolean }> {
    if (!this.isConfigured()) {
      await prisma.webhookLog.create({
        data: {
          event,
          payload: { phone: toWhatsAppNumber(phone), text },
          status: "SKIPPED",
          responseCode: null,
        },
      });
      return { success: false, skipped: true };
    }

    const request = buildProviderRequest(
      this.provider,
      this.apiUrl!,
      this.apiKey!,
      this.instanceName!,
      phone,
      text
    );

    let result: SendAttemptResult = { success: false, responseCode: null };
    let attempts = 0;

    for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
      result = await this.attemptSend(request);
      if (result.success) break;
      if (attempts < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS * attempts);
    }

    await prisma.webhookLog.create({
      data: {
        event,
        payload: {
          provider: this.provider,
          phone: String(request.body.number ?? request.body.phone ?? ""),
          text,
          attempts,
          error: result.error ?? null,
        },
        status: result.success ? "SUCCESS" : "FAILED",
        responseCode: result.responseCode,
      },
    });

    return { success: result.success, skipped: false };
  }
}

export const whatsappService = new WhatsAppService();

type AppointmentWithRelations = Prisma.AppointmentGetPayload<{
  include: { clinicProcedure: { include: { clinic: true; procedure: true } } };
}>;

export function toNotificationData(appointment: AppointmentWithRelations): AppointmentNotificationData {
  return {
    id: appointment.id,
    patientName: appointment.patientName,
    patientPhone: appointment.patientPhone,
    date: appointment.date,
    timeSlot: appointment.timeSlot,
    notes: appointment.notes,
    clinic: {
      tradeName: appointment.clinicProcedure.clinic.tradeName,
      address: appointment.clinicProcedure.clinic.address,
      neighborhood: appointment.clinicProcedure.clinic.neighborhood,
      city: appointment.clinicProcedure.clinic.city,
    },
    procedure: {
      name: appointment.clinicProcedure.procedure.name,
      preparationInstructions: appointment.clinicProcedure.procedure.preparationInstructions,
    },
  };
}

/**
 * Ponto único chamado pelas Server Actions. Nunca lança — dispare sem `await`
 * quando não puder atrasar a resposta ao usuário (ex: criação de agendamento).
 */
export async function notifyAppointmentStatus(status: AppointmentStatus, appointment: AppointmentWithRelations) {
  const data = toNotificationData(appointment);
  const message = buildAppointmentMessage(status, data);
  if (!message) return { success: false, skipped: true };
  return whatsappService.sendMessage(data.patientPhone, message, `appointment.${status.toLowerCase()}`);
}
