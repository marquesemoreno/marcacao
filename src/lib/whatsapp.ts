import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/format";

type SendAttemptResult = {
  success: boolean;
  responseCode: number | null;
  error?: string;
  keyId?: string;
};

/** Referência à mensagem citada (botão "Responder" no balão) — mesmo formato de
 * `key` que a Evolution API/Baileys já usa em toda parte (webhook, updateMessage).
 * `remoteJid` é sempre o telefone do contato (nunca o nosso), independente de quem
 * mandou a mensagem citada — é assim que o Baileys identifica a conversa. */
export type QuotedMessageRef = { keyId: string; remoteJid: string; fromMe: boolean };

function buildQuotedPayload(quoted?: QuotedMessageRef) {
  return quoted ? { quoted: { key: { remoteJid: quoted.remoteJid, fromMe: quoted.fromMe, id: quoted.keyId } } } : {};
}

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
  // "0" + DDD + 9 dígitos = prefixo de discagem local (comum em cadastro de
  // sistema hospitalar — bug real confirmado com dado do bridge da Urolaser:
  // "077991000524" devia ser "5577991000524"). Nenhum DDD brasileiro começa
  // com 0, então não colide com número de verdade.
  else if (digits.length === 12 && digits.startsWith('0')) {
    digits = '55' + digits.substring(1);
  }
  // Se veio sem DDI 55 (ex: 77988411342 ou 7788411342), adiciona 55
  else if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    digits = '55' + digits;
  }

  // Celular brasileiro é DDI(2) + DDD(2) + 9 dígitos = 13 no total. Se sobrou só
  // 12 (DDD + 8 dígitos locais), o WhatsApp/Evolution mandou no formato antigo,
  // sem o "9" que a operadora exige há anos — sem repor, a mensagem vai pra um
  // número que não existe (foi o caso real: "7788411342" devia ser "77988411342").
  if (digits.startsWith('55') && digits.length === 12) {
    digits = digits.slice(0, 4) + '9' + digits.slice(4);
  }

  return digits;
}

export function formatWhatsAppNumber(phone: string): string {
  return formatToWhatsAppNumber(phone);
}

/** Alterna a presença do 9º dígito num número já normalizado (DDI 55 + DDD + resto) —
 * usado como fallback quando o envio no formato "padrão" falha com 400: alguns números
 * (ex: fixo cadastrado como celular, ou celular antigo cuja conta do WhatsApp nunca foi
 * migrada) só existem no WhatsApp no formato SEM o 9, mesmo com 9 dígitos sendo o
 * padrão atual da operadora pra celular. `null` se o número não tiver o formato
 * DDI+DDD+9-dígitos ou DDI+DDD+8-dígitos esperado (não dá pra alternar com segurança). */
export function toggleNinthDigit(target: string): string | null {
  if (!target.startsWith("55")) return null;
  const rest = target.slice(4); // depois de DDI(2)+DDD(2)
  if (target.length === 13 && rest.startsWith("9")) {
    return target.slice(0, 4) + rest.slice(1); // remove o 9 -> 12 dígitos
  }
  if (target.length === 12) {
    return target.slice(0, 4) + "9" + rest; // adiciona o 9 -> 13 dígitos
  }
  return null;
}

/** Um celular brasileiro normalizado é sempre DDI(2) + DDD(2) + 9 dígitos = 13.
 * Números que não se encaixam em nenhuma correção de formatToWhatsAppNumber
 * (ex: dígito a mais/a menos, sem DDI) saem do tamanho errado e por isso não
 * chegam a um destino válido na Evolution API. */
export function isValidWhatsAppNumber(phone: string): boolean {
  const digits = formatToWhatsAppNumber(phone);
  return digits.length === 13 && digits.startsWith("55");
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
 * Busca a URL da foto de perfil pública do WhatsApp de um número via Evolution API v2.
 * POST ${EVOLUTION_API_URL}/chat/fetchProfilePictureUrl/${EVOLUTION_INSTANCE_NAME}
 * Retorna null (não lança erro) quando o contato não tem foto pública, tem a
 * privacidade restrita, ou a instância não está configurada — tudo isso é
 * esperado e deve só cair de volta pro avatar de iniciais, não travar a UI.
 */
export async function fetchWhatsAppProfilePicture(phone: string, clinicId?: string): Promise<string | null> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  if (!apiUrl || !apiKey || !instanceName) return null;

  const target = formatToWhatsAppNumber(phone);
  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: target }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return null;
    const body = await response.json();
    return typeof body?.profilePictureUrl === "string" ? body.profilePictureUrl : null;
  } catch {
    return null;
  }
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
  clinicId?: string,
  quoted?: QuotedMessageRef
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
  const key = apiKey;

  async function attemptSend(number: string): Promise<SendAttemptResult> {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
        },
        body: JSON.stringify({
          number,
          text,
          ...buildQuotedPayload(quoted),
        }),
        signal: AbortSignal.timeout(8000),
      });
      const keyId = response.ok ? await extractKeyId(response) : undefined;
      return { success: response.ok, responseCode: response.status, keyId };
    } catch (error) {
      return {
        success: false,
        responseCode: null,
        error: error instanceof Error ? error.message : "Erro na conexão com Evolution API",
      };
    }
  }

  let result: SendAttemptResult = { success: false, responseCode: null };
  let attempts = 0;

  for (attempts = 1; attempts <= MAX_ATTEMPTS; attempts++) {
    result = await attemptSend(target);
    if (result.success) break;

    if (attempts < MAX_ATTEMPTS) {
      await sleep(RETRY_DELAY_MS * attempts);
    }
  }

  // Fallback: alguns números (fixo cadastrado como celular, celular antigo nunca
  // migrado) só existem no WhatsApp no formato COM/SEM o 9º dígito trocado do que a
  // gente assume por padrão — 400 é o código que a Evolution API devolve pra "número
  // não existe no WhatsApp nesse formato" (bug real confirmado: contato da Urolaser
  // com fixo cadastrado, 8 tentativas falhando até identificar a causa). Só tenta
  // depois de esgotar as tentativas normais, e só se o toggle fizer sentido pro número.
  let fallbackNumber: string | null = null;
  if (!result.success && result.responseCode === 400) {
    fallbackNumber = toggleNinthDigit(target);
    if (fallbackNumber) {
      result = await attemptSend(fallbackNumber);
      if (result.success) {
        // Grava o formato que realmente funciona no Contact — sem isso, todo
        // envio futuro pra esse número repetiria a falha + fallback à toa.
        await prisma.contact
          .updateMany({ where: { phone: target }, data: { phone: fallbackNumber } })
          .catch((error) => console.error("Falha ao atualizar telefone do contato pro formato que funciona:", error));
      }
    }
  }

  await prisma.webhookLog.create({
    data: {
      event,
      payload: {
        provider: "evolution_v2",
        phone: fallbackNumber && result.success ? fallbackNumber : target,
        text,
        attempts,
        error: result.error ?? null,
        quotedKeyId: quoted?.keyId ?? null,
        ninthDigitFallback: fallbackNumber && result.success ? true : undefined,
      },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode, keyId: result.keyId };
}

/**
 * Edita uma mensagem de texto já enviada, via Evolution API v2.
 * POST ${EVOLUTION_API_URL}/chat/updateMessage/${EVOLUTION_INSTANCE_NAME}
 * Payload: { number, key: { id, remoteJid, fromMe: true }, text }
 * `keyId` é o `key.id` (Baileys) guardado em `Message.whatsappKeyId` no envio original —
 * `remoteJid` é reconstruído a partir do telefone porque nunca precisamos guardar o
 * objeto `key` inteiro pra nada além disso (`fromMe` é sempre true: só editamos
 * mensagem nossa). O WhatsApp só aceita edição dentro de ~15 min do envio original
 * (ver canEditMessage em src/lib/message-edit.ts) — passado isso a própria Meta
 * rejeita/ignora, então essa checagem já acontece antes de chegar aqui.
 */
export async function editWhatsAppMessage(
  to: string,
  keyId: string,
  newText: string,
  event: string = "whatsapp.edit",
  clinicId?: string
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  const target = formatToWhatsAppNumber(to);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: { event, payload: { phone: target, keyId, text: newText }, status: "SKIPPED", responseCode: null },
    });
    return { success: false, skipped: true };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/chat/updateMessage/${instanceName}`;

  let result: SendAttemptResult = { success: false, responseCode: null };
  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: target,
        key: { id: keyId, remoteJid: `${target}@s.whatsapp.net`, fromMe: true },
        text: newText,
      }),
      signal: AbortSignal.timeout(8000),
    });
    result = { success: response.ok, responseCode: response.status };
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
      payload: { provider: "evolution_v2", phone: target, keyId, text: newText, error: result.error ?? null },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode };
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
  clinicId?: string,
  quoted?: QuotedMessageRef
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
  const key = apiKey;

  async function attemptSend(number: string): Promise<SendAttemptResult> {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({
          number,
          mediatype,
          mimetype: mimeType,
          caption,
          media: mediaUrl,
          fileName,
          ...buildQuotedPayload(quoted),
        }),
        signal: AbortSignal.timeout(15000),
      });
      const keyId = response.ok ? await extractKeyId(response) : undefined;
      return { success: response.ok, responseCode: response.status, keyId };
    } catch (error) {
      return {
        success: false,
        responseCode: null,
        error: error instanceof Error ? error.message : "Erro na conexão com Evolution API",
      };
    }
  }

  let result = await attemptSend(target);

  // Mesmo fallback de sendWhatsAppMessage (ver toggleNinthDigit) — número que só
  // existe no WhatsApp com o 9º dígito trocado do formato que a gente assume.
  let fallbackNumber: string | null = null;
  if (!result.success && result.responseCode === 400) {
    fallbackNumber = toggleNinthDigit(target);
    if (fallbackNumber) {
      result = await attemptSend(fallbackNumber);
      if (result.success) {
        await prisma.contact
          .updateMany({ where: { phone: target }, data: { phone: fallbackNumber } })
          .catch((error) => console.error("Falha ao atualizar telefone do contato pro formato que funciona:", error));
      }
    }
  }

  await prisma.webhookLog.create({
    data: {
      event,
      payload: {
        provider: "evolution_v2",
        phone: fallbackNumber && result.success ? fallbackNumber : target,
        fileName,
        mediatype,
        error: result.error ?? null,
        ninthDigitFallback: fallbackNumber && result.success ? true : undefined,
      },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode, keyId: result.keyId };
}

/**
 * Envio de áudio como mensagem de voz (PTT) via Evolution API v2 — endpoint dedicado,
 * diferente do sendMedia genérico, pra chegar como "voice note" nativo do WhatsApp
 * (com forma de onda e ícone de microfone), igual ao que a clínica recebe dos pacientes.
 * POST ${EVOLUTION_API_URL}/message/sendWhatsAppAudio/${EVOLUTION_INSTANCE_NAME}
 */
export async function sendWhatsAppAudio(
  to: string,
  mediaUrl: string,
  event: string = "whatsapp.send_audio",
  clinicId?: string
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null; keyId?: string }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  const target = formatToWhatsAppNumber(to);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: {
        event,
        payload: { phone: target },
        status: "SKIPPED",
        responseCode: null,
      },
    });
    return { success: false, skipped: true };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/message/sendWhatsAppAudio/${instanceName}`;
  const key = apiKey;

  async function attemptSend(number: string): Promise<SendAttemptResult> {
    try {
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: key },
        body: JSON.stringify({
          number,
          audio: mediaUrl,
          ptt: true,
        }),
        signal: AbortSignal.timeout(15000),
      });
      const keyId = response.ok ? await extractKeyId(response) : undefined;
      return { success: response.ok, responseCode: response.status, keyId };
    } catch (error) {
      return {
        success: false,
        responseCode: null,
        error: error instanceof Error ? error.message : "Erro na conexão com Evolution API",
      };
    }
  }

  let result = await attemptSend(target);

  // Mesmo fallback de sendWhatsAppMessage/sendWhatsAppMedia (ver toggleNinthDigit).
  let fallbackNumber: string | null = null;
  if (!result.success && result.responseCode === 400) {
    fallbackNumber = toggleNinthDigit(target);
    if (fallbackNumber) {
      result = await attemptSend(fallbackNumber);
      if (result.success) {
        await prisma.contact
          .updateMany({ where: { phone: target }, data: { phone: fallbackNumber } })
          .catch((error) => console.error("Falha ao atualizar telefone do contato pro formato que funciona:", error));
      }
    }
  }

  await prisma.webhookLog.create({
    data: {
      event,
      payload: {
        provider: "evolution_v2",
        phone: fallbackNumber && result.success ? fallbackNumber : target,
        error: result.error ?? null,
        ninthDigitFallback: fallbackNumber && result.success ? true : undefined,
      },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode, keyId: result.keyId };
}

/**
 * Envio de cartão de contato nativo (vCard) via Evolution API v2 — chega como a
 * bolha real de contato do WhatsApp, não um arquivo .vcf anexado.
 * POST ${EVOLUTION_API_URL}/message/sendContact/${EVOLUTION_INSTANCE_NAME}
 */
export async function sendWhatsAppContact(
  to: string,
  contactName: string,
  contactPhone: string,
  event: string = "whatsapp.send_contact",
  clinicId?: string
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null; keyId?: string }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);
  const target = formatToWhatsAppNumber(to);
  const contactWuid = formatToWhatsAppNumber(contactPhone);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: {
        event,
        payload: { phone: target },
        status: "SKIPPED",
        responseCode: null,
      },
    });
    return { success: false, skipped: true };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/message/sendContact/${instanceName}`;

  let result: SendAttemptResult = { success: false, responseCode: null };

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        number: target,
        contact: [{ fullName: contactName, wuid: contactWuid, phoneNumber: contactWuid }],
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
      payload: { provider: "evolution_v2", phone: target, contactName, error: result.error ?? null },
      status: result.success ? "SUCCESS" : "FAILED",
      responseCode: result.responseCode,
    },
  });

  return { success: result.success, skipped: false, responseCode: result.responseCode, keyId: result.keyId };
}

/**
 * Reage (ou remove a reação) numa mensagem específica via Evolution API v2 —
 * chega como a reação nativa do WhatsApp, igual reagir a uma mensagem no app.
 * `emoji: ""` remove a reação atual. POST ${EVOLUTION_API_URL}/message/sendReaction/${EVOLUTION_INSTANCE_NAME}
 */
export async function sendWhatsAppReaction(
  target: QuotedMessageRef,
  emoji: string,
  event: string = "whatsapp.send_reaction",
  clinicId?: string
): Promise<{ success: boolean; skipped: boolean; responseCode?: number | null }> {
  const { apiUrl, apiKey, instanceName } = await getEvolutionConfig(clinicId);

  if (!apiUrl || !apiKey || !instanceName) {
    await prisma.webhookLog.create({
      data: {
        event,
        payload: { keyId: target.keyId },
        status: "SKIPPED",
        responseCode: null,
      },
    });
    return { success: false, skipped: true };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/message/sendReaction/${instanceName}`;

  let result: SendAttemptResult = { success: false, responseCode: null };

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({
        key: { remoteJid: target.remoteJid, fromMe: target.fromMe, id: target.keyId },
        reaction: emoji,
      }),
      signal: AbortSignal.timeout(15000),
    });
    result = { success: response.ok, responseCode: response.status };
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
      payload: { provider: "evolution_v2", keyId: target.keyId, emoji, error: result.error ?? null },
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
 * Dispara a mensagem oficial de confirmação de agendamento via WhatsApp.
 * `conversationId`, quando informado, também grava essa mensagem no histórico do
 * chat da plataforma — sem isso ela só aparecia no WhatsApp de verdade (web/
 * celular), nunca no inbox (bug real relatado por atendente). Opcional porque
 * nem toda chamada tem uma Conversation em mãos (ex: agendamento feito direto
 * pelo site público, antes de qualquer troca de mensagem por WhatsApp).
 */
export async function sendAppointmentConfirmation(appointment: AppointmentWithRelations, conversationId?: string) {
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

  const result = await sendWhatsAppMessage(appointment.patientPhone, messageText, "appointment.confirmation");
  if (conversationId) {
    await prisma.message.create({
      data: { conversationId, direction: "OUTBOUND", content: messageText, status: "DELIVERED" },
    });
  }
  return result;
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
  sendMessage: (phone: string, text: string, event: string, clinicId?: string, quoted?: QuotedMessageRef) =>
    sendWhatsAppMessage(phone, text, event, clinicId, quoted),
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
