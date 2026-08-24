"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { whatsappService, sendWhatsAppMedia } from "@/lib/whatsapp";
import { hasSantaClaraBridgeIntegration, fetchSantaClaraProcedures, adaptBridgeProcedureToPlainItem } from "@/lib/santa-clara-bridge";
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

const ACTIVE_STATUSES: ConversationStatus[] = [ConversationStatus.OPEN, ConversationStatus.PENDING];

export async function listChatContactsAdmin(filter: InboxFilter, search?: string) {
  await requireAdminSession();

  const where =
    filter === "minhas"
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
    where: { role: { in: ["ADMIN", "CLINIC"] } },
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

export async function listCannedResponsesAdmin() {
  await requireAdminSession();
  return prisma.cannedResponse.findMany({
    orderBy: { shortcut: "asc" },
  });
}

export async function listClinicProceduresForAppointmentAdmin(clinicId: string) {
  await requireAdminSession();

  if (await hasSantaClaraBridgeIntegration(clinicId)) {
    const bridgeProcedures = await fetchSantaClaraProcedures();
    return bridgeProcedures.map((p) => adaptBridgeProcedureToPlainItem(clinicId, p));
  }

  const procedures = await prisma.clinicProcedure.findMany({
    where: { clinicId, clinic: { active: true } },
    include: { clinic: true, procedure: { include: { specialty: true } } },
    orderBy: { procedure: { name: "asc" } },
  });

  return procedures.map(toPlainClinicProcedureItem);
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
