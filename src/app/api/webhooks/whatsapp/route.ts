import { NextResponse } from "next/server";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAppointmentConfirmation, sendWhatsAppMessage, formatToWhatsAppNumber, getEvolutionConfig } from "@/lib/whatsapp";
import { fetchMediaBase64, uploadWhatsAppMedia, formatDuration } from "@/lib/whatsapp-media";
import { formatFileSize } from "@/lib/format";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { MEDIA_DOWNLOAD_FAILED_PREFIX } from "@/lib/chat-messages";
import {
  getAiAttendantConfig,
  buildAiDisclosureMessage,
  AI_CONSENT_ACCEPTED_REPLY,
  AI_HANDOFF_MESSAGE,
  parseConsentReply,
  matchEscalationTrigger,
  generateAiReply,
} from "@/lib/ai-attendant";

type IncomingMedia =
  | { kind: "image" | "document"; mimeType: string; fileName: string; sizeBytes: number; key: Record<string, unknown> }
  | { kind: "audio"; mimeType: string; seconds: number; key: Record<string, unknown> };

type IncomingMessage = { phone: string; text: string; name?: string; media?: IncomingMedia; keyId?: string };

/**
 * Extrai a mensagem recebida no webhook da Evolution API v2 (ou payload simplificado).
 * Reconhece texto, imagem, documento e áudio — o conteúdo em si não vem no próprio
 * webhook (só metadados), é buscado depois via fetchMediaBase64 usando `media.key`.
 */
function extractIncomingMessage(body: unknown): IncomingMessage | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  if (typeof payload.phone === "string" && typeof payload.text === "string") {
    return {
      phone: formatToWhatsAppNumber(payload.phone),
      text: payload.text,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const key = data?.key as Record<string, unknown> | undefined;
  const remoteJid = key?.remoteJid;
  const message = data?.message as Record<string, unknown> | undefined;
  const pushName = data?.pushName;

  if (typeof remoteJid !== "string") return null;
  const name = typeof pushName === "string" ? pushName : undefined;
  const phone = formatToWhatsAppNumber(remoteJid);
  // ID da mensagem no WhatsApp — guardado em Message.whatsappKeyId pra depois casar
  // com o evento "messages.delete" (mesmo campo já usado pra ack de mensagem enviada).
  const keyId = typeof key?.id === "string" ? key.id : undefined;

  const extended = message?.extendedTextMessage as Record<string, unknown> | undefined;
  const text = message?.conversation ?? extended?.text;
  if (typeof text === "string") {
    return { phone, text, name, keyId };
  }

  const audioMessage = message?.audioMessage as Record<string, unknown> | undefined;
  if (audioMessage && key && typeof audioMessage.mimetype === "string") {
    const seconds = Number(audioMessage.seconds ?? 0) || 0;
    return {
      phone,
      text: "🎤 Áudio recebido",
      name,
      keyId,
      media: { kind: "audio", mimeType: audioMessage.mimetype, seconds, key },
    };
  }

  const imageMessage = message?.imageMessage as Record<string, unknown> | undefined;
  const documentMessage = message?.documentMessage as Record<string, unknown> | undefined;
  const mediaMessage = imageMessage ?? documentMessage;

  if (mediaMessage && key && typeof mediaMessage.mimetype === "string") {
    const caption = typeof mediaMessage.caption === "string" ? mediaMessage.caption : "";
    const isImage = Boolean(imageMessage);
    const fileName =
      typeof mediaMessage.fileName === "string"
        ? mediaMessage.fileName
        : isImage
          ? "imagem.jpg"
          : "documento";
    const sizeBytes = Number(mediaMessage.fileLength ?? 0) || 0;

    return {
      phone,
      text: caption || (isImage ? "📷 Imagem recebida" : "📄 Documento recebido"),
      name,
      keyId,
      media: { kind: isImage ? "image" : "document", mimeType: mediaMessage.mimetype, fileName, sizeBytes, key },
    };
  }

  return null;
}

const ACK_STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ"> = {
  SERVER_ACK: "SENT",
  DELIVERY_ACK: "DELIVERED",
  READ: "READ",
  PLAYED: "READ",
};
const STATUS_RANK: Record<string, number> = { PENDING: 0, FAILED: 0, SENT: 1, DELIVERED: 2, READ: 3 };

/**
 * Trata o webhook "messages.update" (ack de entrega/leitura da Evolution API).
 * Só nos interessam acks de mensagens QUE NÓS enviamos (fromMe: true) — o keyId
 * é o Baileys key.id capturado no envio (ver sendWhatsAppMessage/sendWhatsAppMedia)
 * e gravado em Message.whatsappKeyId. Nunca regride o status (ex: um DELIVERY_ACK
 * atrasado não pode sobrescrever um READ que já chegou antes).
 */
async function handleMessageStatusUpdate(data: Record<string, unknown>) {
  const keyId = data.keyId;
  const fromMe = Boolean(data.fromMe);
  const mapped = typeof data.status === "string" ? ACK_STATUS_MAP[data.status] : undefined;

  if (!fromMe || typeof keyId !== "string" || !mapped) {
    await logInbound({ kind: "message_status_update", ...data }, "IGNORED");
    return;
  }

  const message = await prisma.message.findUnique({
    where: { whatsappKeyId: keyId },
    select: { id: true, status: true },
  });
  if (!message) {
    await logInbound({ kind: "message_status_update", ...data, mapped }, "IGNORED");
    return;
  }
  if (STATUS_RANK[mapped] <= STATUS_RANK[message.status]) {
    await logInbound({ kind: "message_status_update", ...data, mapped, currentStatus: message.status }, "SKIPPED");
    return;
  }

  await prisma.message.update({
    where: { id: message.id },
    data: { status: mapped, ...(mapped === "READ" ? { readAt: new Date() } : {}) },
  });
  notifyInboxRealtime().catch(() => {});
  await logInbound({ kind: "message_status_update", ...data, mapped, messageDbId: message.id }, "SUCCESS");
}

/**
 * Trata o webhook "messages.delete" — dispara quando alguém apaga uma mensagem no
 * WhatsApp (paciente ou atendente, "apagar para todos"). Formato real confirmado via
 * WebhookLog: `data.id` é o mesmo id do Baileys que já gravamos em Message.whatsappKeyId
 * ao enviar/receber. Não apaga a mensagem — só marca deletedAt, mantendo o conteúdo
 * original no banco (a tela troca a exibição por "Mensagem apagada").
 */
async function handleMessageDelete(data: Record<string, unknown>) {
  const keyId = data.id;
  if (typeof keyId !== "string") {
    await logInbound({ kind: "message_delete", ...data }, "IGNORED");
    return;
  }

  const message = await prisma.message.findUnique({ where: { whatsappKeyId: keyId }, select: { id: true } });
  if (!message) {
    await logInbound({ kind: "message_delete", ...data }, "IGNORED");
    return;
  }

  await prisma.message.update({ where: { id: message.id }, data: { deletedAt: new Date() } });
  notifyInboxRealtime().catch(() => {});
  await logInbound({ kind: "message_delete", ...data, messageDbId: message.id }, "SUCCESS");
}

function resolveStatusFromReply(text: string): AppointmentStatus | null {
  const normalized = text.trim().toUpperCase();
  if (normalized === "1" || normalized === "SIM" || normalized === "SIM, CONFIRMO") return "CONFIRMED";
  if (normalized === "2" || normalized === "CANCELAR" || normalized === "NÃO" || normalized === "NAO") return "CANCELLED";
  return null;
}

async function logInbound(payload: Prisma.InputJsonValue, status: string) {
  await prisma.webhookLog.create({
    data: {
      event: "whatsapp.inbound",
      payload,
      status,
      responseCode: null,
    },
  });
}

/**
 * Garante um Contact para o telefone e uma Conversation aberta no painel de atendimento.
 * `resolvedClinicId` já vem definido quando a mensagem chegou por uma instância exclusiva
 * de clínica (ver resolução por `instance` no POST) — nesse caso pula direto o fallback
 * de casar por Appointment/clínica-mais-antiga, que é só pra instância global compartilhada.
 */
async function findOrCreateConversation(phone: string, name: string | undefined, resolvedClinicId?: string) {
  const fullPhone = formatToWhatsAppNumber(phone);
  const phoneSuffix = fullPhone.slice(-11);

  const contact = await prisma.contact.upsert({
    where: { phone: fullPhone },
    update: name ? { name } : {},
    create: { phone: fullPhone, name: name ?? fullPhone },
  });

  // Instância global: reaproveita qualquer conversa já existente do contato (comportamento
  // original). Instância exclusiva: só reaproveita se já houver conversa DESSA clínica com
  // esse contato — senão cria uma nova, em vez de herdar uma conversa antiga de outra clínica
  // (ex: o mesmo telefone já ter escrito pro número compartilhado antes).
  //
  // Tudo dentro de uma trava consultiva por contactId (pg_advisory_xact_lock, liberada
  // sozinha no fim da transação): sem ela, duas mensagens do WhatsApp chegando quase juntas
  // pro mesmo telefone (ex: imagem + legenda, ou reentrega do webhook da Evolution API)
  // podiam ambas passar pelo "findFirst" antes de qualquer "create" confirmar, e cada uma
  // criava sua própria Conversation pro mesmo Contact — o paciente aparecendo em duas
  // conversas diferentes na tela do atendente. A trava serializa esse trecho por contato;
  // contatos diferentes não se bloqueiam entre si.
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${contact.id})::bigint)`;

    const existingConversation = await tx.conversation.findFirst({
      where: resolvedClinicId ? { contactId: contact.id, clinicId: resolvedClinicId } : { contactId: contact.id },
      orderBy: { createdAt: "desc" },
    });
    if (existingConversation) {
      return { contact, conversation: existingConversation, isNewConversation: false };
    }

    let clinicId = resolvedClinicId;

    if (!clinicId) {
      const appointment = await tx.appointment.findFirst({
        where: {
          patientPhone: { endsWith: phoneSuffix },
          status: { in: ["PENDING", "CONFIRMED"] },
        },
        orderBy: { createdAt: "desc" },
        select: { clinicProcedure: { select: { clinicId: true } } },
      });
      clinicId = appointment?.clinicProcedure.clinicId;
    }

    if (!clinicId) {
      const defaultClinic = await tx.clinic.findFirst({
        where: { active: true },
        orderBy: { createdAt: "asc" },
      });
      clinicId = defaultClinic?.id;
    }

    if (!clinicId) {
      return { contact, conversation: null, isNewConversation: false };
    }

    const conversation = await tx.conversation.create({
      data: {
        clinicId,
        contactId: contact.id,
        status: "OPEN",
        lastMessageAt: new Date(),
      },
    });
    return { contact, conversation, isNewConversation: true };
  });
}

export async function POST(request: Request) {
  const requiredSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (requiredSecret) {
    const providedSecret = request.headers.get("x-webhook-token");
    if (providedSecret !== requiredSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const bodyRec = body as Record<string, unknown>;
  const dataPayload = bodyRec?.data as Record<string, unknown> | undefined;

  // =========================================================================
  // -1. RESOLUÇÃO DE INSTÂNCIA: a Evolution API manda o nome da instância que
  // originou o evento em `body.instance`. Se bater com uma instância exclusiva
  // de clínica (painel admin → WhatsApp), toda a mensagem já nasce vinculada
  // àquela clínica — sem depender do fallback por Appointment/clínica-padrão,
  // que continua existindo só pra instância global compartilhada.
  // =========================================================================
  const instanceNameFromPayload = typeof bodyRec.instance === "string" ? bodyRec.instance : undefined;
  const dedicatedInstance = instanceNameFromPayload
    ? await prisma.whatsappInstance.findUnique({ where: { instanceName: instanceNameFromPayload } })
    : null;
  const resolvedClinicId = dedicatedInstance?.clinicId;
  const evolutionConfig = dedicatedInstance
    ? { apiUrl: dedicatedInstance.apiUrl, apiKey: dedicatedInstance.apiKey, instanceName: dedicatedInstance.instanceName }
    : await getEvolutionConfig();

  // =========================================================================
  // 0. ACK DE ENTREGA/LEITURA: evento separado, tratado antes da trava anti-loop
  // (que ignoraria fromMe:true e descartaria justamente os acks das nossas mensagens)
  // =========================================================================
  if (bodyRec.event === "messages.update" && dataPayload) {
    await handleMessageStatusUpdate(dataPayload);
    return NextResponse.json({ ok: true, status: "message_status_update" }, { status: 200 });
  }

  // Mesma lógica: precisa vir antes da trava anti-loop porque o próprio atendente
  // pode apagar uma mensagem que ele mandou (fromMe:true nesse caso).
  if (bodyRec.event === "messages.delete" && dataPayload) {
    await handleMessageDelete(dataPayload);
    return NextResponse.json({ ok: true, status: "message_deleted" }, { status: 200 });
  }

  // =========================================================================
  // 1. TRAVA ANTI-LOOP: ignora mensagens enviadas pela própria instância / bot / atendente
  // =========================================================================
  const keyObj = (dataPayload?.key || bodyRec?.key) as Record<string, unknown> | undefined;
  const isFromMe = Boolean(
    keyObj?.fromMe ?? dataPayload?.fromMe ?? bodyRec?.fromMe
  );

  if (isFromMe) {
    return NextResponse.json({ ignored: true, reason: "outbound_message" }, { status: 200 });
  }

  const incoming = extractIncomingMessage(body);
  if (!incoming) {
    await logInbound(body, "IGNORED");
    return NextResponse.json({ ignored: true, reason: "non_message_event" }, { status: 200 });
  }

  // =========================================================================
  // 2. REGISTRO E APRESENTAÇÃO NA CAIXA DE ENTRADA DO CHAT (/admin/inbox)
  // =========================================================================
  const { contact, conversation, isNewConversation } = await findOrCreateConversation(incoming.phone, incoming.name, resolvedClinicId);

  // Opt-out de disparo em massa (LGPD — saída fácil de mensagem não solicitada, ver
  // src/lib/broadcast.ts). Independente do fluxo de IA/automação abaixo, e permanente
  // pra qualquer clínica: uma vez que a pessoa pede pra sair, nunca mais entra em
  // campanha nenhuma enquanto isso não for revertido manualmente. Não usa "cancelar"
  // sozinho aqui: essa palavra já significa "cancelar agendamento" no fluxo de
  // confirmação mais abaixo (resolveStatusFromReply) — usar aqui roubaria essa resposta.
  if (/^(sair|parar)$/i.test(incoming.text.trim())) {
    if (!contact.optedOutOfBroadcastsAt) {
      await prisma.contact.update({ where: { id: contact.id }, data: { optedOutOfBroadcastsAt: new Date() } });
    }
    const optOutReply = "Você não vai mais receber nossos avisos. Se quiser voltar a receber, é só nos chamar por aqui.";
    if (conversation) {
      await prisma.message.create({
        data: { conversationId: conversation.id, direction: "OUTBOUND", content: optOutReply, status: "DELIVERED" },
      });
    }
    sendWhatsAppMessage(incoming.phone, optOutReply, "broadcast.opt_out", resolvedClinicId).catch(() => {});
    notifyInboxRealtime().catch(() => {});
    return NextResponse.json({ ok: true, status: "opted_out" }, { status: 200 });
  }

  if (conversation) {
    type MediaData =
      | { type: "ATTACHMENT"; mediaPath: string; mimeType: string; attachmentName: string; attachmentSize: string }
      | { type: "AUDIO"; mediaPath: string; mimeType: string; audioDuration: string };

    let mediaData: MediaData | null = null;

    if (incoming.media) {
      const mediaResult = await fetchMediaBase64(incoming.media.key, evolutionConfig);
      const uploaded = mediaResult.success
        ? await uploadWhatsAppMedia(conversation.id, Buffer.from(mediaResult.base64, "base64"), incoming.media.mimeType)
        : null;

      const incomingFileName = "fileName" in incoming.media ? incoming.media.fileName : null;
      if (!mediaResult.success) {
        await logInbound(
          { kind: "media_download_failed", fileName: incomingFileName, mimeType: incoming.media.mimeType, error: mediaResult.error },
          "FAILED"
        );
      } else if (!uploaded) {
        await logInbound(
          { kind: "media_upload_failed", fileName: incomingFileName, mimeType: incoming.media.mimeType },
          "FAILED"
        );
      }

      if (uploaded) {
        mediaData =
          incoming.media.kind === "audio"
            ? {
                type: "AUDIO",
                mediaPath: uploaded.path,
                mimeType: incoming.media.mimeType,
                audioDuration: formatDuration(incoming.media.seconds),
              }
            : {
                type: "ATTACHMENT",
                mediaPath: uploaded.path,
                mimeType: incoming.media.mimeType,
                attachmentName: incoming.media.fileName,
                attachmentSize: formatFileSize(uploaded.sizeBytes || incoming.media.sizeBytes),
              };
      }
    }

    const failedMediaNotice = incoming.media && !mediaData
      ? incoming.media.kind === "audio"
        ? `${MEDIA_DOWNLOAD_FAILED_PREFIX} o áudio recebido.`
        : `${MEDIA_DOWNLOAD_FAILED_PREFIX} o anexo recebido (${incoming.media.fileName}).`
      : null;

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        content: failedMediaNotice ?? incoming.text,
        status: "DELIVERED",
        whatsappKeyId: incoming.keyId,
        ...(mediaData ?? {}),
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: conversation.status === "RESOLVED" ? "OPEN" : conversation.status },
    });

    // =========================================================================
    // 2.1 MENSAGEM DE BOAS-VINDAS: dispara só na primeira Conversation de verdade
    // desse contato com a clínica (não em toda mensagem, nem em conversa já
    // existente/resolvida — ver isNewConversation em findOrCreateConversation).
    // Como é o cliente que inicia o contato, cai na janela de atendimento de 24h
    // do WhatsApp Business — mensagem livre permitida, sem exigir template
    // pré-aprovado pela Meta.
    // =========================================================================
    const clinic = await prisma.clinic.findUnique({
      where: { id: conversation.clinicId },
      select: { tradeName: true, welcomeMessageEnabled: true, welcomeMessageText: true },
    });

    if (isNewConversation) {
      const welcomeText = clinic?.welcomeMessageEnabled ? clinic.welcomeMessageText?.trim() : null;
      if (welcomeText) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "OUTBOUND",
            content: welcomeText,
            status: "DELIVERED",
          },
        });
        sendWhatsAppMessage(incoming.phone, welcomeText, "welcome_message.sent", resolvedClinicId).catch(() => {});
      }
    }

    // =========================================================================
    // 2.2 ATENDENTE DE IA: consentimento (LGPD) -> escalação -> resposta gerada.
    // Só entra em jogo se a clínica tiver AiAttendantConfig ativo (ver
    // src/lib/ai-attendant.ts). Enquanto isso não acontecer, `aiHandled` fica
    // false e a mensagem cai no fluxo de automação por keyword de sempre.
    // =========================================================================
    let aiHandled = false;
    const aiConfig = clinic ? await getAiAttendantConfig(conversation.clinicId) : null;
    const clinicName = clinic?.tradeName ?? "nossa clínica";

    if (aiConfig) {
      if (conversation.aiConsentStatus === "NOT_ASKED") {
        const disclosure = buildAiDisclosureMessage(clinicName);
        await prisma.message.create({
          data: { conversationId: conversation.id, direction: "OUTBOUND", content: disclosure, status: "DELIVERED" },
        });
        await prisma.conversation.update({ where: { id: conversation.id }, data: { aiConsentStatus: "PENDING" } });
        sendWhatsAppMessage(incoming.phone, disclosure, "ai_attendant.disclosure_sent", resolvedClinicId).catch(() => {});
        aiHandled = true;
      } else if (conversation.aiConsentStatus === "PENDING") {
        // Ambíguo conta como recusa: consentimento LGPD precisa ser uma afirmação
        // inequívoca, nunca presumido. A conversa segue no fluxo humano normal.
        const consent = parseConsentReply(incoming.text);
        if (consent === "ACCEPTED") {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { aiConsentStatus: "ACCEPTED", aiEnabled: true },
          });
          await prisma.message.create({
            data: { conversationId: conversation.id, direction: "OUTBOUND", content: AI_CONSENT_ACCEPTED_REPLY, status: "DELIVERED" },
          });
          sendWhatsAppMessage(incoming.phone, AI_CONSENT_ACCEPTED_REPLY, "ai_attendant.consent_accepted", resolvedClinicId).catch(() => {});
        } else {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: { aiConsentStatus: "DECLINED", aiEnabled: false },
          });
        }
        aiHandled = true;
      } else if (conversation.aiEnabled) {
        const escalationReason = matchEscalationTrigger(incoming.text);
        if (escalationReason) {
          await prisma.conversation.update({ where: { id: conversation.id }, data: { aiEnabled: false } });
          await prisma.message.create({
            data: { conversationId: conversation.id, direction: "OUTBOUND", content: AI_HANDOFF_MESSAGE, status: "DELIVERED" },
          });
          sendWhatsAppMessage(incoming.phone, AI_HANDOFF_MESSAGE, "ai_attendant.escalated", resolvedClinicId).catch(() => {});
          await prisma.aiInteractionLog.create({
            data: { conversationId: conversation.id, userMessage: incoming.text, escalated: true, escalationReason },
          });
        } else {
          const reply = await generateAiReply(conversation.id, clinicName, aiConfig.instructions);
          if (reply) {
            await prisma.message.create({
              data: { conversationId: conversation.id, direction: "OUTBOUND", content: reply, status: "DELIVERED" },
            });
            sendWhatsAppMessage(incoming.phone, reply, "ai_attendant.replied", resolvedClinicId).catch(() => {});
            await prisma.aiInteractionLog.create({
              data: { conversationId: conversation.id, userMessage: incoming.text, aiResponse: reply },
            });
          } else {
            // Falha ao gerar resposta (sem API key, erro da OpenAI etc): escala pra
            // humano em vez de deixar o paciente sem nenhuma resposta.
            await prisma.conversation.update({ where: { id: conversation.id }, data: { aiEnabled: false } });
            await prisma.message.create({
              data: { conversationId: conversation.id, direction: "OUTBOUND", content: AI_HANDOFF_MESSAGE, status: "DELIVERED" },
            });
            sendWhatsAppMessage(incoming.phone, AI_HANDOFF_MESSAGE, "ai_attendant.failed_escalated", resolvedClinicId).catch(() => {});
            await prisma.aiInteractionLog.create({
              data: { conversationId: conversation.id, userMessage: incoming.text, escalated: true, escalationReason: "Falha ao gerar resposta da IA" },
            });
          }
        }
        aiHandled = true;
      }
    }

    if (!aiHandled) {
      const activeAutomations = await prisma.chatAutomation.findMany({
        where: { active: true },
      });
      const textLower = incoming.text.toLowerCase();
      const matchedAutomation = activeAutomations.find((auto) =>
        textLower.includes(auto.keyword.toLowerCase())
      );

      if (matchedAutomation) {
        await prisma.message.create({
          data: {
            conversationId: conversation.id,
            direction: "OUTBOUND",
            content: matchedAutomation.responseText,
            status: "DELIVERED",
          },
        });
        sendWhatsAppMessage(incoming.phone, matchedAutomation.responseText, "chat_automation.triggered", resolvedClinicId).catch(() => {});
      }
    }

    notifyInboxRealtime().catch(() => {});
  }

  // =========================================================================
  // 3. TRATAMENTO DE COMANDOS DO PACIENTE (1 - CONFIRMAR / 2 - CANCELAR)
  // =========================================================================
  const newStatus = resolveStatusFromReply(incoming.text);
  if (!newStatus) {
    await logInbound(
      {
        phone: incoming.phone,
        text: incoming.text,
        conversationId: conversation?.id ?? null,
        clinicId: conversation?.clinicId ?? null,
        instanceNameFromPayload: instanceNameFromPayload ?? null,
        resolvedViaDedicatedInstance: Boolean(resolvedClinicId),
        reason: conversation ? "mensagem de chat recebida no inbox" : "sem clínica resolvida — só logado",
      },
      conversation ? "SUCCESS" : "IGNORED"
    );
    return NextResponse.json({ ok: true, status: "chat_message_received" }, { status: 200 });
  }

  const phoneDigits = formatToWhatsAppNumber(incoming.phone);
  const phoneSuffix = phoneDigits.slice(-11);

  const appointment = await prisma.appointment.findFirst({
    where: {
      patientPhone: { endsWith: phoneSuffix },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  if (!appointment) {
    await logInbound(
      { phone: incoming.phone, text: incoming.text, reason: "nenhum agendamento ativo encontrado para este número" },
      "FAILED"
    );
    return NextResponse.json({ ok: true, status: "no_active_appointment" }, { status: 200 });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: newStatus },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  await logInbound(
    { phone: incoming.phone, text: incoming.text, appointmentId: appointment.id, newStatus },
    "SUCCESS"
  );

  // Se confirmado com "1" ou "SIM", envia a Guia Oficial com QR Code.
  if (newStatus === "CONFIRMED") {
    sendAppointmentConfirmation(updated).catch((error) => {
      console.error("Falha ao enviar confirmação com Guia QR Code:", error);
    });
  } else if (newStatus === "CANCELLED") {
    const cancelMsg = `Olá ${updated.patientName}! Seu agendamento para ${updated.clinicProcedure.procedure.name} na ${updated.clinicProcedure.clinic.tradeName} foi cancelado com sucesso. Caso precise remarcar, acesse nosso site!`;
    sendWhatsAppMessage(updated.patientPhone, cancelMsg, "appointment.cancelled.ack").catch(() => {});
  }

  return NextResponse.json({ ok: true, status: newStatus }, { status: 200 });
}
