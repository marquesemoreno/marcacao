"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { whatsappService, sendWhatsAppMedia, sendWhatsAppAudio, formatToWhatsAppNumber, fetchWhatsAppProfilePicture } from "@/lib/whatsapp";
import { hasSantaClaraBridgeIntegration, fetchSantaClaraProcedures, fetchSantaClaraDoctors, fetchSantaClaraAgenda, fetchSantaClaraConvenios, adaptBridgeProcedureToPlainItem } from "@/lib/santa-clara-bridge";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { departmentToDb, funnelStageToDb, toChatContact, toChatMessage } from "@/lib/chat-crm-adapters";
import { attachSignedUrls, uploadWhatsAppMedia, getSignedMediaUrl } from "@/lib/whatsapp-media";
import { formatFileSize } from "@/lib/format";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import type { Department, FunnelStage, InboxFilter } from "@/types/chat-crm";
import {
  sendMessageSchema,
  updateTagsSchema,
} from "@/lib/schemas/inbox";

const ALLOWED_MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_MEDIA_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB — mesma ordem de grandeza do limite de mídia do WhatsApp
const MESSAGE_PAGE_SIZE = 50;
const CONTACT_PHOTO_CACHE_DAYS = 30;

const ACTIVE_STATUSES: ConversationStatus[] = [ConversationStatus.OPEN, ConversationStatus.PENDING];

/** Uma linha por contato cadastrado em qualquer clínica — usado na aba "Contatos"
 * do admin pra buscar por nome/telefone/CPF e ver de qual clínica é. */
export async function listAllContactsAdmin(search?: string) {
  await requireAdminSession();

  const conversations = await prisma.conversation.findMany({
    where: search
      ? {
          contact: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { phone: { contains: search } },
              { cpf: { contains: search } },
            ],
          },
        }
      : {},
    include: { contact: true, clinic: { select: { tradeName: true } } },
    orderBy: { contact: { name: "asc" } },
  });

  return conversations.map((conversation) => ({
    conversationId: conversation.id,
    name: conversation.contact.name,
    phone: conversation.contact.phone,
    cpf: conversation.contact.cpf,
    status: conversation.status,
    clinicName: conversation.clinic.tradeName,
  }));
}

export async function listChatContactsAdmin(filter: InboxFilter, search?: string) {
  await requireAdminSession();

  // Com busca ativa, ignora o filtro de aba e procura em todas as conversas —
  // ver o mesmo comentário em listConversations (inbox.ts).
  const where = search
    ? {}
    : filter === "minhas"
      ? { status: { in: ACTIVE_STATUSES } }
      : filter === "nao_atribuidas"
        ? { assignedUserId: null, status: { in: ACTIVE_STATUSES } }
        : filter === "finalizadas"
          ? { status: ConversationStatus.RESOLVED }
          : { status: { in: ACTIVE_STATUSES } };

  const conversations = await prisma.conversation.findMany({
    where: {
      ...where,
      ...(search
        ? {
            contact: {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { cpf: { contains: search } },
              ],
            },
          }
        : {}),
    },
    include: {
      contact: true,
      clinic: { select: { id: true, tradeName: true } },
      assignedUser: { select: { id: true, name: true } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  const unreadCounts = await prisma.message.groupBy({
    by: ["conversationId"],
    where: {
      conversationId: { in: conversations.map((c) => c.id) },
      direction: "INBOUND",
      readAt: null,
    },
    _count: { id: true },
  });
  const unreadByConversation = new Map(unreadCounts.map((u) => [u.conversationId, u._count.id]));

  return conversations.map((c) =>
    toChatContact({
      ...c,
      unreadCount: unreadByConversation.get(c.id) ?? 0,
    })
  );
}

/** Lista enxuta pro seletor de "trocar clínica da conversa" — ver updateConversationClinicAdmin. */
export async function listClinicsForReassignment() {
  await requireAdminSession();
  return prisma.clinic.findMany({
    where: { active: true },
    select: { id: true, tradeName: true },
    orderBy: { tradeName: "asc" },
  });
}

/** Mesma ideia de createContact (inbox.ts), mas o admin escolhe a clínica na hora,
 * já que ele não está vinculado a uma só. */
export async function createContactAdmin(name: string, phone: string, clinicId: string) {
  await requireAdminSession();

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
  if (!clinic) throw new Error("Clínica não encontrada");

  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Informe o nome do contato.");
  }
  const fullPhone = formatToWhatsAppNumber(phone);
  if (fullPhone.length < 12) {
    throw new Error("Telefone inválido. Informe com DDD (ex: 77999998888).");
  }

  const contact = await prisma.contact.upsert({
    where: { phone: fullPhone },
    update: {},
    create: { phone: fullPhone, name: trimmedName },
  });

  let conversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id, clinicId },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: { clinicId, contactId: contact.id, status: "OPEN", lastMessageAt: new Date() },
    });
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
  return conversation.id;
}

/** Corrige a clínica de uma conversa que caiu na atribuição automática errada
 * (webhook do WhatsApp usa a 1ª clínica cadastrada como fallback quando não
 * acha agendamento pendente/confirmado pro telefone — ver route.ts). */
export async function updateConversationClinicAdmin(conversationId: string, clinicId: string) {
  await requireAdminSession();
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
  if (!clinic) throw new Error("Clínica não encontrada");

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { clinicId },
  });
  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
}

export async function listChatAgentsAdmin() {
  await requireAdminSession();
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "CLINIC"] }, active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    name: u.name,
    avatar: "",
    role: u.role === "ADMIN" ? "Administrador Master" : "Atendente",
  }));
}

/** Só as `MESSAGE_PAGE_SIZE` mensagens mais recentes — ver getOlderChatMessagesAdmin
 * pro histórico mais antigo, carregado sob demanda pelo botão na tela. */
export async function getChatMessagesAdmin(conversationId: string) {
  await requireAdminSession();
  const latest = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE,
    include: { senderUser: { select: { id: true, name: true } } },
  });

  const withMediaUrls = await attachSignedUrls(latest.reverse());
  return { messages: withMediaUrls.map(toChatMessage), hasMore: latest.length === MESSAGE_PAGE_SIZE };
}

export async function getOlderChatMessagesAdmin(conversationId: string, beforeMessageId: string) {
  await requireAdminSession();

  const cursor = await prisma.message.findUnique({
    where: { id: beforeMessageId },
    select: { createdAt: true },
  });
  if (!cursor) return { messages: [], hasMore: false };

  const older = await prisma.message.findMany({
    where: { conversationId, createdAt: { lt: cursor.createdAt } },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE,
    include: { senderUser: { select: { id: true, name: true } } },
  });

  const withMediaUrls = await attachSignedUrls(older.reverse());
  return { messages: withMediaUrls.map(toChatMessage), hasMore: older.length === MESSAGE_PAGE_SIZE };
}

export async function getChatContactHistoryAdmin(conversationId: string) {
  await requireAdminSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contact: { select: { phone: true } } },
  });
  if (!conversation) return [];

  const appointments = await prisma.appointment.findMany({
    where: { patientPhone: conversation.contact.phone },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
    orderBy: { date: "desc" },
    take: 5,
  });

  const statusMap = { PENDING: "agendada", CONFIRMED: "agendada", COMPLETED: "concluida", CANCELLED: "cancelada", NO_SHOW: "cancelada" } as const;

  return appointments.map((a) => ({
    id: a.id,
    specialty: a.clinicProcedure.procedure.name,
    doctor: a.clinicProcedure.clinic.tradeName,
    date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(a.date),
    status: statusMap[a.status],
  }));
}

export async function sendMessageAdmin(conversationId: string, content: string, isInternalNote?: boolean) {
  const { userId } = await requireAdminSession();
  const data = sendMessageSchema.parse({ conversationId, content, isInternalNote });

  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    include: { contact: true },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  if (isInternalNote) {
    const note = await prisma.message.create({
      data: {
        conversationId: data.conversationId,
        direction: "OUTBOUND",
        content: data.content,
        status: "SENT",
        type: "INTERNAL_NOTE",
        senderUserId: userId,
      },
    });
    await prisma.conversation.update({
      where: { id: data.conversationId },
      data: { lastMessageAt: new Date() },
    });
    revalidatePath("/admin/inbox");
    notifyInboxRealtime().catch(() => {});
    return note;
  }

  const message = await prisma.message.create({
    data: {
      conversationId: data.conversationId,
      direction: "OUTBOUND",
      content: data.content,
      status: "SENT",
      senderUserId: userId,
    },
  });

  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN" },
  });

  // Disparo assíncrono não-bloqueante para a Evolution API em segundo plano com timeout de 4s
  whatsappService.sendMessage(conversation.contact.phone, data.content, "chat.outbound_admin", conversation.clinicId).then((result) => {
    if (!result.success && !result.skipped) {
      prisma.message.update({
        where: { id: message.id },
        data: { status: "FAILED" },
      }).catch(() => {});
    } else if (result.keyId) {
      prisma.message.update({
        where: { id: message.id },
        data: { whatsappKeyId: result.keyId },
      }).catch(() => {});
    }
  }).catch(() => {});

  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
  return message;
}

/** Atendente (admin) anexa uma imagem ou PDF pra enviar ao paciente pelo WhatsApp. */
export async function sendMediaMessageAdmin(conversationId: string, formData: FormData) {
  const { userId } = await requireAdminSession();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Nenhum arquivo enviado");
  if (!ALLOWED_MEDIA_MIME_TYPES.includes(file.type)) {
    throw new Error("Tipo de arquivo não suportado. Envie uma imagem ou um PDF.");
  }
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error("Arquivo muito grande. O limite é 15 MB.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });
  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadWhatsAppMedia(conversationId, buffer, file.type);
  if (!uploaded) {
    throw new Error("Não foi possível processar o arquivo. Tente novamente.");
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      content: "",
      status: "SENT",
      type: "ATTACHMENT",
      mediaPath: uploaded.path,
      mimeType: file.type,
      attachmentName: file.name,
      attachmentSize: formatFileSize(uploaded.sizeBytes),
      senderUserId: userId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN" },
  });

  const signedUrl = await getSignedMediaUrl(uploaded.path);
  if (signedUrl) {
    sendWhatsAppMedia(conversation.contact.phone, signedUrl, file.type, file.name, "", "chat.outbound_admin.media", conversation.clinicId)
      .then((result) => {
        if (!result.success && !result.skipped) {
          prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
        } else if (result.keyId) {
          prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } }).catch(() => {});
        }
      })
      .catch(() => {});
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
  return message;
}

/** Reenvia uma mensagem OUTBOUND que falhou (texto, anexo ou áudio) — ver resendMessage (inbox.ts). */
export async function resendMessageAdmin(messageId: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) throw new Error("Mensagem não encontrada");
  if (message.direction !== "OUTBOUND" || message.type === "INTERNAL_NOTE") {
    throw new Error("Essa mensagem não pode ser reenviada.");
  }

  await prisma.message.update({ where: { id: messageId }, data: { status: "SENT" } });
  const phone = message.conversation.contact.phone;
  const clinicId = message.conversation.clinicId;

  if (message.type === "ATTACHMENT" || message.type === "AUDIO") {
    if (!message.mediaPath) throw new Error("Arquivo original não encontrado para reenviar.");
    const signedUrl = await getSignedMediaUrl(message.mediaPath);
    if (!signedUrl) throw new Error("Não foi possível gerar o link do arquivo.");

    const result =
      message.type === "AUDIO"
        ? await sendWhatsAppAudio(phone, signedUrl, "chat.retry.audio", clinicId)
        : await sendWhatsAppMedia(
            phone,
            signedUrl,
            message.mimeType || "application/octet-stream",
            message.attachmentName || "arquivo",
            "",
            "chat.retry.media",
            clinicId
          );

    if (!result.success && !result.skipped) {
      await prisma.message.update({ where: { id: messageId }, data: { status: "FAILED" } });
      throw new Error("Falha ao reenviar. Tente novamente em instantes.");
    }
    if (result.keyId) {
      await prisma.message.update({ where: { id: messageId }, data: { whatsappKeyId: result.keyId } });
    }
  } else {
    const result = await whatsappService.sendMessage(phone, message.content, "chat.retry_admin", clinicId);
    if (!result.success && !result.skipped) {
      await prisma.message.update({ where: { id: messageId }, data: { status: "FAILED" } });
      throw new Error("Falha ao reenviar. Tente novamente em instantes.");
    }
    if (result.keyId) {
      await prisma.message.update({ where: { id: messageId }, data: { whatsappKeyId: result.keyId } });
    }
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
}

export async function getAttendantCapacityAdmin() {
  const { userId } = await requireAdminSession();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { maxConcurrentChats: true },
  });
  const maxLimit = user?.maxConcurrentChats ?? 5;

  const activeCount = await prisma.conversation.count({
    where: {
      assignedUserId: userId,
      status: "OPEN",
    },
  });

  return { activeCount, maxLimit };
}

export async function assignConversationToUserAdmin(conversationId: string, targetUserId: string | null) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: targetUserId, status: "OPEN" },
  });
  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function claimConversationAdmin(conversationId: string) {
  const { userId } = await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  if (!conversation) {
    return { success: false, message: "Conversa não encontrada." };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: userId, status: "OPEN" },
  });

  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function transferConversationAdmin(conversationId: string, targetUserId: string) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: targetUserId, status: "OPEN" },
  });

  revalidatePath("/admin/inbox");
  return { success: true };
}

export async function updateConversationTagsAdmin(conversationId: string, tags: string[]) {
  await requireAdminSession();
  const data = updateTagsSchema.parse({ conversationId, tags });
  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: { tags: data.tags },
  });
  revalidatePath("/admin/inbox");
}

export async function updateContactInfoAdmin(conversationId: string, data: { name: string; cpf?: string }) {
  await requireAdminSession();

  const trimmedName = data.name.trim();
  if (trimmedName.length < 2) {
    throw new Error("Informe o nome do paciente.");
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contactId: true },
  });
  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.contact.update({
    where: { id: conversation.contactId },
    data: { name: trimmedName, cpf: data.cpf?.trim() || null },
  });
  revalidatePath("/admin/inbox");
}

export async function refreshContactPhotoAdmin(conversationId: string) {
  await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true, contact: { select: { id: true, phone: true, photoUrl: true, photoUpdatedAt: true } } },
  });
  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  const { contact } = conversation;
  const cacheAgeMs = contact.photoUpdatedAt ? Date.now() - contact.photoUpdatedAt.getTime() : Infinity;
  if (cacheAgeMs < CONTACT_PHOTO_CACHE_DAYS * 24 * 60 * 60 * 1000) {
    return contact.photoUrl;
  }

  const photoUrl = await fetchWhatsAppProfilePicture(contact.phone, conversation.clinicId);
  await prisma.contact.update({
    where: { id: contact.id },
    data: { photoUrl, photoUpdatedAt: new Date() },
  });
  return photoUrl;
}

export async function updateConversationFunnelStageAdmin(conversationId: string, stage: FunnelStage) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { funnelStage: funnelStageToDb[stage] },
  });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/crm");
}

export async function resolveConversationAdmin(conversationId: string, resolutionData?: { reason: string; notes?: string }) {
  const { userId } = await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: ConversationStatus.RESOLVED,
      resolutionReason: resolutionData?.reason ?? "Atendimento finalizado",
      resolutionNotes: resolutionData?.notes ?? null,
      resolvedAt: new Date(),
      resolvedByUserId: userId,
    },
  });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/crm");
}

export async function reopenConversationAdmin(conversationId: string) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: ConversationStatus.OPEN, resolvedAt: null, resolutionReason: null, resolutionNotes: null },
  });
  revalidatePath("/admin/inbox");
  revalidatePath("/admin/crm");
}

/** Reabre a mensagem mais recente do paciente como não lida — ver markConversationUnread (inbox.ts). */
export async function markConversationUnreadAdmin(conversationId: string) {
  await requireAdminSession();
  const lastInbound = await prisma.message.findFirst({
    where: { conversationId, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
  });
  if (lastInbound) {
    await prisma.message.update({ where: { id: lastInbound.id }, data: { readAt: null } });
  }
  revalidatePath("/admin/inbox");
}

export async function listCannedResponsesAdmin() {
  await requireAdminSession();
  return prisma.cannedResponse.findMany({
    orderBy: { shortcut: "asc" },
  });
}

/** Atalho criado pelo admin fica global (clinicId null) — visível em todas as clínicas,
 * já que essa tela não tem seletor de clínica específica. */
export async function createCannedResponseAdmin(shortcut: string, content: string) {
  await requireAdminSession();
  const normalizedShortcut = shortcut.trim().startsWith("/") ? shortcut.trim() : `/${shortcut.trim()}`;
  const trimmedContent = content.trim();
  if (normalizedShortcut === "/" || !trimmedContent) {
    throw new Error("Preencha o atalho e o texto da resposta.");
  }

  try {
    return await prisma.cannedResponse.create({
      data: { clinicId: null, shortcut: normalizedShortcut, content: trimmedContent },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Já existe uma resposta rápida com o atalho "${normalizedShortcut}".`);
    }
    throw error;
  }
}

export async function updateCannedResponseAdmin(id: string, shortcut: string, content: string) {
  await requireAdminSession();
  const normalizedShortcut = shortcut.trim().startsWith("/") ? shortcut.trim() : `/${shortcut.trim()}`;
  const trimmedContent = content.trim();
  if (normalizedShortcut === "/" || !trimmedContent) {
    throw new Error("Preencha o atalho e o texto da resposta.");
  }

  try {
    return await prisma.cannedResponse.update({
      where: { id },
      data: { shortcut: normalizedShortcut, content: trimmedContent },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Já existe uma resposta rápida com o atalho "${normalizedShortcut}".`);
    }
    throw error;
  }
}

export async function deleteCannedResponseAdmin(id: string) {
  await requireAdminSession();
  await prisma.cannedResponse.delete({ where: { id } });
}

export async function listClinicProceduresForAppointmentAdmin(clinicId: string, convenioId?: string) {
  await requireAdminSession();

  if (await hasSantaClaraBridgeIntegration(clinicId)) {
    const bridgeProcedures = await fetchSantaClaraProcedures(convenioId ? Number(convenioId) : undefined);
    return bridgeProcedures.map((p) => adaptBridgeProcedureToPlainItem(clinicId, p));
  }

  const procedures = await prisma.clinicProcedure.findMany({
    where: { clinicId, clinic: { active: true } },
    include: { clinic: true, procedure: { include: { specialty: true } } },
    orderBy: { procedure: { name: "asc" } },
  });

  return procedures.map(toPlainClinicProcedureItem);
}

export async function listClinicDoctorsForAppointmentAdmin(clinicId: string) {
  await requireAdminSession();
  if (!(await hasSantaClaraBridgeIntegration(clinicId))) return [];
  return fetchSantaClaraDoctors();
}

export async function listClinicConveniosForAppointmentAdmin(clinicId: string) {
  await requireAdminSession();
  if (!(await hasSantaClaraBridgeIntegration(clinicId))) return [];
  return fetchSantaClaraConvenios();
}

export async function getClinicDoctorAgendaAdmin(clinicId: string, medicoId: number, date: string) {
  await requireAdminSession();
  if (!(await hasSantaClaraBridgeIntegration(clinicId))) return [];
  return fetchSantaClaraAgenda(medicoId, date);
}

export async function suggestIaReplyAdmin(conversationId: string) {
  await requireAdminSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      clinic: true,
      messages: { orderBy: { createdAt: "desc" }, take: 3 },
    },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  const patientName = conversation.contact.name.split(" ")[0];
  const lastInbound = conversation.messages.find((m) => m.direction === "INBOUND");
  const lastText = lastInbound?.content.toLowerCase() || "";

  if (lastText.includes("jejum") || lastText.includes("preparo")) {
    return `Olá, ${patientName}! 👋 Para exames de ultrassonografia e laboratoriais, recomendamos jejum de 8 a 12 horas. Como posso te auxiliar com seu atendimento hoje?`;
  }
  if (lastText.includes("valor") || lastText.includes("preço") || lastText.includes("quanto")) {
    return `Olá, ${patientName}! 👋 Nossas consultas e exames são particulares com valores negociados sob consulta e sem mensalidade. Qual especialidade você precisa?`;
  }
  if (lastText.includes("endereco") || lastText.includes("localizacao") || lastText.includes("onde")) {
    return `Olá, ${patientName}! 👋 Ficamos localizados na ${conversation.clinic.address}, no bairro ${conversation.clinic.neighborhood}. Gostaria de agendar seu horário?`;
  }

  return `Olá, ${patientName}! 👋 Obrigado por entrar em contato com a Conecta Saúde. Como posso te ajudar com o seu agendamento hoje?`;
}
