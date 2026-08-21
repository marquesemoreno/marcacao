import { NextResponse } from "next/server";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sendAppointmentConfirmation, sendWhatsAppMessage, formatToWhatsAppNumber } from "@/lib/whatsapp";
import { fetchMediaBase64, uploadWhatsAppMedia, formatDuration } from "@/lib/whatsapp-media";
import { formatFileSize } from "@/lib/format";

type IncomingMedia =
  | { kind: "image" | "document"; mimeType: string; fileName: string; sizeBytes: number; key: Record<string, unknown> }
  | { kind: "audio"; mimeType: string; seconds: number; key: Record<string, unknown> };

type IncomingMessage = { phone: string; text: string; name?: string; media?: IncomingMedia };

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

  const extended = message?.extendedTextMessage as Record<string, unknown> | undefined;
  const text = message?.conversation ?? extended?.text;
  if (typeof text === "string") {
    return { phone, text, name };
  }

  const audioMessage = message?.audioMessage as Record<string, unknown> | undefined;
  if (audioMessage && key && typeof audioMessage.mimetype === "string") {
    const seconds = Number(audioMessage.seconds ?? 0) || 0;
    return {
      phone,
      text: "🎤 Áudio recebido",
      name,
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
      media: { kind: isImage ? "image" : "document", mimeType: mediaMessage.mimetype, fileName, sizeBytes, key },
    };
  }

  return null;
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
 */
async function findOrCreateConversation(phone: string, name: string | undefined) {
  const fullPhone = formatToWhatsAppNumber(phone);
  const phoneSuffix = fullPhone.slice(-11);

  const contact = await prisma.contact.upsert({
    where: { phone: fullPhone },
    update: name ? { name } : {},
    create: { phone: fullPhone, name: name ?? fullPhone },
  });

  const existingConversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id },
    orderBy: { createdAt: "desc" },
  });
  if (existingConversation) {
    return { contact, conversation: existingConversation };
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      patientPhone: { endsWith: phoneSuffix },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { clinicProcedure: { select: { clinicId: true } } },
  });

  let clinicId = appointment?.clinicProcedure.clinicId;

  if (!clinicId) {
    const defaultClinic = await prisma.clinic.findFirst({
      where: { active: true },
      orderBy: { createdAt: "asc" },
    });
    clinicId = defaultClinic?.id;
  }

  if (!clinicId) {
    return { contact, conversation: null };
  }

  const conversation = await prisma.conversation.create({
    data: {
      clinicId,
      contactId: contact.id,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });
  return { contact, conversation };
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

  // =========================================================================
  // 1. TRAVA ANTI-LOOP: ignora mensagens enviadas pela própria instância / bot / atendente
  // =========================================================================
  const bodyRec = body as Record<string, unknown>;
  const dataPayload = bodyRec?.data as Record<string, unknown> | undefined;
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
  const { conversation } = await findOrCreateConversation(incoming.phone, incoming.name);

  if (conversation) {
    type MediaData =
      | { type: "ATTACHMENT"; mediaPath: string; mimeType: string; attachmentName: string; attachmentSize: string }
      | { type: "AUDIO"; mediaPath: string; mimeType: string; audioDuration: string };

    let mediaData: MediaData | null = null;

    if (incoming.media) {
      const base64 = await fetchMediaBase64(incoming.media.key);
      const uploaded = base64
        ? await uploadWhatsAppMedia(conversation.id, Buffer.from(base64, "base64"), incoming.media.mimeType)
        : null;

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
        ? "⚠️ Não foi possível baixar o áudio recebido."
        : `⚠️ Não foi possível baixar o anexo recebido (${incoming.media.fileName}).`
      : null;

    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        content: failedMediaNotice ?? incoming.text,
        status: "DELIVERED",
        ...(mediaData ?? {}),
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: conversation.status === "RESOLVED" ? "OPEN" : conversation.status },
    });

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
      sendWhatsAppMessage(incoming.phone, matchedAutomation.responseText, "chat_automation.triggered").catch(() => {});
    }
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
