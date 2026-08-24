"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { whatsappService } from "@/lib/whatsapp";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { toChatContact, toChatMessage, departmentToDb, funnelStageToDb } from "@/lib/chat-crm-adapters";
import { attachSignedUrls, uploadWhatsAppMedia, getSignedMediaUrl, formatDuration } from "@/lib/whatsapp-media";
import { sendWhatsAppMedia, sendWhatsAppAudio } from "@/lib/whatsapp";
import { hasSantaClaraBridgeIntegration, fetchSantaClaraProcedures, fetchSantaClaraDoctors, adaptBridgeProcedureToPlainItem } from "@/lib/santa-clara-bridge";
import { formatFileSize } from "@/lib/format";
import { notifyInboxRealtime } from "@/lib/supabase-server";

const ALLOWED_MEDIA_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_MEDIA_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB — mesma ordem de grandeza do limite de mídia do WhatsApp
const MESSAGE_PAGE_SIZE = 50;
import type { Department, FunnelStage, InboxFilter } from "@/types/chat-crm";
import { applyMessageVariables, getBaseUrl } from "@/lib/format";
import {
  sendMessageSchema,
  updateTagsSchema,
  type ConversationFilter,
} from "@/lib/schemas/inbox";

const ACTIVE_STATUSES: ConversationStatus[] = [ConversationStatus.OPEN, ConversationStatus.PENDING];

export async function listConversations(filter: ConversationFilter, search?: string) {
  const { clinicId, userId } = await requireClinicSession();

  const where =
    filter === "mine"
      ? { clinicId, assignedUserId: userId, status: { in: ACTIVE_STATUSES } }
      : filter === "unassigned"
        ? { clinicId, assignedUserId: null, status: { in: ACTIVE_STATUSES } }
        : filter === "resolved"
          ? { clinicId, status: ConversationStatus.RESOLVED }
          : { clinicId, status: { in: ACTIVE_STATUSES } };

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

  return conversations.map((conversation) => ({
    ...conversation,
    unreadCount: unreadByConversation.get(conversation.id) ?? 0,
  }));
}

export async function getConversation(conversationId: string) {
  const { clinicId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      assignedUser: { select: { id: true, name: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { senderUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  return conversation;
}

export async function markConversationRead(conversationId: string) {
  const { clinicId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.message.updateMany({
    where: { conversationId, direction: "INBOUND", readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/clinic/inbox");
}

export async function sendMessage(conversationId: string, content: string, isInternalNote = false) {
  const { clinicId, userId } = await requireClinicSession();
  const data = sendMessageSchema.parse({ conversationId, content });

  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    include: { contact: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
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
    revalidatePath("/clinic/inbox");
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

  // Dispara o envio ao WhatsApp via Evolution API em segundo plano (assíncrono), liberando a interface instantaneamente
  whatsappService.sendMessage(conversation.contact.phone, data.content, "chat.outbound", clinicId).then((result) => {
    if (!result.success && !result.skipped) {
      prisma.message.update({
        where: { id: message.id },
        data: { status: "FAILED" },
      }).catch(() => {});
    } else if (result.keyId) {
      // Guarda o key.id do WhatsApp pra casar com os acks de entrega/leitura (webhook messages.update)
      prisma.message.update({
        where: { id: message.id },
        data: { whatsappKeyId: result.keyId },
      }).catch(() => {});
    }
  }).catch(() => {});

  revalidatePath("/clinic/inbox");
  revalidatePath("/admin/inbox");
  return message;
}

/** Atendente anexa uma imagem ou PDF pra enviar ao paciente pelo WhatsApp. */
export async function sendMediaMessage(conversationId: string, formData: FormData) {
  const { clinicId, userId } = await requireClinicSession();

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
  if (!conversation || conversation.clinicId !== clinicId) {
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

  // Mesma URL assinada que a UI usa pra exibir — a Evolution API busca o arquivo nela.
  const signedUrl = await getSignedMediaUrl(uploaded.path);
  if (signedUrl) {
    sendWhatsAppMedia(conversation.contact.phone, signedUrl, file.type, file.name, "", "chat.outbound.media", clinicId)
      .then((result) => {
        if (!result.success && !result.skipped) {
          prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
        } else if (result.keyId) {
          prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } }).catch(() => {});
        }
      })
      .catch(() => {});
  }

  revalidatePath("/clinic/inbox");
  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
  return message;
}

/** Atendente grava um áudio no navegador e envia como mensagem de voz (PTT) real do WhatsApp. */
export async function sendAudioMessage(conversationId: string, formData: FormData) {
  const { clinicId, userId } = await requireClinicSession();

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Nenhum áudio enviado");
  if (!file.type.startsWith("audio/")) {
    throw new Error("Arquivo inválido. Envie um áudio.");
  }
  if (file.size > MAX_MEDIA_SIZE_BYTES) {
    throw new Error("Áudio muito grande. O limite é 15 MB.");
  }
  const durationSeconds = Number(formData.get("duration")) || 0;

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const uploaded = await uploadWhatsAppMedia(conversationId, buffer, file.type);
  if (!uploaded) {
    throw new Error("Não foi possível processar o áudio. Tente novamente.");
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      content: "",
      status: "SENT",
      type: "AUDIO",
      mediaPath: uploaded.path,
      mimeType: file.type,
      audioDuration: formatDuration(durationSeconds),
      senderUserId: userId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN" },
  });

  const signedUrl = await getSignedMediaUrl(uploaded.path);
  if (signedUrl) {
    sendWhatsAppAudio(conversation.contact.phone, signedUrl, "chat.outbound.audio", clinicId)
      .then((result) => {
        if (!result.success && !result.skipped) {
          prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
        } else if (result.keyId) {
          prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } }).catch(() => {});
        }
      })
      .catch(() => {});
  }

  revalidatePath("/clinic/inbox");
  revalidatePath("/admin/inbox");
  notifyInboxRealtime().catch(() => {});
  return message;
}

export async function getAttendantCapacity() {
  const { userId } = await requireClinicSession();
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

export async function claimConversation(conversationId: string) {
  const { clinicId, userId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  if (!conversation || conversation.clinicId !== clinicId) {
    return { success: false, message: "Conversa não encontrada." };
  }

  if (conversation.assignedUserId && conversation.assignedUserId !== userId) {
    const assignedName = conversation.assignedUser?.name || "outro atendente";
    return {
      success: false,
      message: `Esta conversa já foi assumida por ${assignedName}.`,
    };
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, maxConcurrentChats: true, role: true },
  });
  const userName = currentUser?.name || "Atendente";
  const maxLimit = currentUser?.maxConcurrentChats ?? 5;

  const activeCount = await prisma.conversation.count({
    where: {
      assignedUserId: userId,
      status: "OPEN",
      id: { not: conversationId },
    },
  });

  if (activeCount >= maxLimit && currentUser?.role !== "ADMIN") {
    return {
      success: false,
      message: `Limite de atendimentos atingido: você já possui ${activeCount}/${maxLimit} conversas abertas. Finalize um atendimento antes de assumir novos pacientes.`,
    };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      assignedUserId: userId,
      status: "OPEN",
    },
  });

  await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "INTERNAL_NOTE",
      content: `🔒 Atendimento assumido por ${userName}.`,
      status: "SENT",
      senderUserId: userId,
    },
  });

  revalidatePath("/clinic/inbox");
  revalidatePath("/clinic/crm");
  return { success: true };
}

export async function transferConversation(
  conversationId: string,
  targetUserId: string,
  department?: Department
) {
  const { clinicId, userId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });

  if (!conversation || conversation.clinicId !== clinicId) {
    return { success: false, message: "Conversa não encontrada." };
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { name: true, maxConcurrentChats: true, role: true },
  });

  if (!targetUser) {
    return { success: false, message: "Atendente de destino não encontrado." };
  }

  const maxLimit = targetUser.maxConcurrentChats ?? 5;
  const activeCount = await prisma.conversation.count({
    where: {
      assignedUserId: targetUserId,
      status: "OPEN",
      id: { not: conversationId },
    },
  });

  if (activeCount >= maxLimit && targetUser.role !== "ADMIN") {
    return {
      success: false,
      message: `Limite atingido: ${targetUser.name} já possui ${activeCount}/${maxLimit} conversas abertas.`,
    };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      assignedUserId: targetUserId,
      ...(department ? { department: departmentToDb[department] } : {}),
    },
  });

  await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "INTERNAL_NOTE",
      content: `🔒 Conversa transferida para ${targetUser.name}.`,
      status: "SENT",
      senderUserId: userId,
    },
  });

  revalidatePath("/clinic/inbox");
  revalidatePath("/clinic/crm");
  return { success: true };
}

export async function assignConversationToMe(conversationId: string) {
  const result = await claimConversation(conversationId);
  if (!result.success) {
    throw new Error(result.message);
  }
}

const REASON_LABELS: Record<string, string> = {
  AGENDAMENTO_CONCLUIDO: "🎟️ Agendamento Concluído",
  DUVIDA_ESCLARECIDA: "💡 Dúvida Esclarecida / Informações",
  ORCAMENTO_ENVIADO: "💲 Orçamento Enviado",
  SEM_RESPOSTA: "⏳ Paciente Não Respondeu / Inativo",
  CANCELAMENTO: "❌ Cancelamento / Desistência",
  ENCAMINHADO: "🔄 Encaminhado para Outro Setor",
};

export async function resolveConversation(
  conversationId: string,
  resolutionData?: { reason: string; notes?: string }
) {
  const { clinicId, userId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const userName = currentUser?.name || "Atendente";
  const reasonKey = resolutionData?.reason || "DUVIDA_ESCLARECIDA";
  const reasonLabel = REASON_LABELS[reasonKey] || reasonKey;

  await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      status: "RESOLVED",
      resolutionReason: reasonKey,
      resolutionNotes: resolutionData?.notes || null,
      resolvedAt: new Date(),
      resolvedByUserId: userId,
    },
  });

  await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "INTERNAL_NOTE",
      content: `🏁 Atendimento finalizado por ${userName} • Motivo: ${reasonLabel}${resolutionData?.notes ? `\n\nObs: ${resolutionData.notes}` : ""}`,
      status: "SENT",
      senderUserId: userId,
    },
  });

  revalidatePath("/clinic/inbox");
  revalidatePath("/clinic/crm");
}

export async function reopenConversation(conversationId: string) {
  const { clinicId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "OPEN" },
  });
  revalidatePath("/clinic/inbox");
}

export async function updateConversationTags(conversationId: string, tags: string[]) {
  const { clinicId } = await requireClinicSession();
  const data = updateTagsSchema.parse({ conversationId, tags });

  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: { tags: data.tags },
  });
  revalidatePath("/clinic/inbox");
}

/** Versão "achatada" (sem Decimal) de listClinicProcedures, para o atalho
 * "Criar Agendamento" no painel do contato — chamado direto do client. */
export async function listClinicProceduresForAppointment() {
  const { clinicId } = await requireClinicSession();

  if (await hasSantaClaraBridgeIntegration(clinicId)) {
    const bridgeProcedures = await fetchSantaClaraProcedures();
    return bridgeProcedures.map((p) => adaptBridgeProcedureToPlainItem(clinicId, p));
  }

  const items = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: { procedure: true },
    orderBy: { procedure: { name: "asc" } },
  });
  return items.map(toPlainClinicProcedureItem);
}

/** Só clínicas com integração hospitalar (Santa Clara/bridge) têm médico específico
 * no agendamento rápido — as demais do marketplace não têm esse conceito, retorna vazio. */
export async function listClinicDoctorsForAppointment() {
  const { clinicId } = await requireClinicSession();
  if (!(await hasSantaClaraBridgeIntegration(clinicId))) return [];
  return fetchSantaClaraDoctors();
}

export async function listCannedResponses() {
  const { clinicId } = await requireClinicSession();
  return prisma.cannedResponse.findMany({
    where: { OR: [{ clinicId }, { clinicId: null }] },
    orderBy: { shortcut: "asc" },
  });
}

const INBOX_FILTER_TO_CONVERSATION_FILTER: Record<InboxFilter, ConversationFilter> = {
  minhas: "mine",
  nao_atribuidas: "unassigned",
  todas: "all",
  finalizadas: "resolved",
};

/** Camada visual do módulo de atendimento (src/components/chat/) — mesmo dado de
 * listConversations, mapeado para o formato Contact usado pelo design novo. */
export async function listChatContacts(filter: InboxFilter, search?: string) {
  const conversations = await listConversations(INBOX_FILTER_TO_CONVERSATION_FILTER[filter], search);
  return conversations.map(toChatContact);
}

async function assertClinicOwnsConversation(conversationId: string, clinicId: string) {
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }
}

/** Só as `MESSAGE_PAGE_SIZE` mensagens mais recentes — o histórico completo de
 * conversas antigas pode ter milhares de linhas, carregar tudo a cada poll de
 * 5s é o gargalo que motivou essa paginação. Mais antigas via getOlderChatMessages. */
export async function getChatMessages(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsConversation(conversationId, clinicId);

  const latest = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE,
    include: { senderUser: { select: { id: true, name: true } } },
  });

  const withMediaUrls = await attachSignedUrls(latest.reverse());
  return { messages: withMediaUrls.map(toChatMessage), hasMore: latest.length === MESSAGE_PAGE_SIZE };
}

/** Página anterior (mais antiga) do histórico, a partir do id da mensagem mais
 * antiga já carregada na tela — usado pelo botão "Carregar mensagens anteriores". */
export async function getOlderChatMessages(conversationId: string, beforeMessageId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsConversation(conversationId, clinicId);

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

export async function listChatAgents() {
  const { clinicId } = await requireClinicSession();
  const users = await prisma.user.findMany({
    where: { clinicId, role: "CLINIC" },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  return users.map((user) => ({ id: user.id, name: user.name, avatar: "", role: "Equipe da clínica" }));
}

/** Histórico clínico do contato (consultas/exames já realizados ou agendados),
 * casado por telefone dentro da própria clínica — Appointment não tem FK para
 * Contact porque o fluxo público de agendamento não exige login/cadastro prévio. */
export async function getChatContactHistory(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true, contact: { select: { phone: true } } },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  const appointments = await prisma.appointment.findMany({
    where: { patientPhone: conversation.contact.phone, clinicProcedure: { clinicId } },
    include: { clinicProcedure: { include: { procedure: true } } },
    orderBy: { date: "desc" },
    take: 10,
  });

  const statusMap = { PENDING: "agendada", CONFIRMED: "agendada", COMPLETED: "concluida", CANCELLED: "cancelada", NO_SHOW: "cancelada" } as const;

  return appointments.map((appointment) => ({
    id: appointment.id,
    specialty: appointment.clinicProcedure.procedure.name,
    doctor: appointment.timeSlot ? `Horário: ${appointment.timeSlot}` : "Ordem de chegada",
    date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(appointment.date),
    status: statusMap[appointment.status],
    price: undefined,
  }));
}

export async function assignConversationToUser(conversationId: string, targetUserId: string) {
  const { clinicId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: targetUserId },
  });
  revalidatePath("/clinic/inbox");
}

export async function updateConversationFunnelStage(conversationId: string, stage: FunnelStage) {
  const { clinicId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, clinic: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { funnelStage: funnelStageToDb[stage] },
  });

  if (stage === "agendado") {
    const appointment = await prisma.appointment.findFirst({
      where: {
        patientPhone: { endsWith: conversation.contact.phone.slice(-11) },
        status: { in: ["PENDING", "CONFIRMED"] },
      },
      orderBy: { createdAt: "desc" },
      include: { clinicProcedure: { include: { procedure: true } } },
    });

    const patientFirstName = conversation.contact.name.split(" ")[0];
    const clinicName = conversation.clinic.tradeName;
    const procedureName = appointment?.clinicProcedure.procedure.name || "Consulta/Exame";
    const guideUrl = appointment
      ? `${getBaseUrl()}/comprovante/${appointment.id}`
      : `${getBaseUrl()}/procedimentos`;

    const rawTemplate = "✅ *Agendamento Confirmado!* 👋 Olá, {{nome}}! Seu agendamento para *{{procedimento}}* na clínica *{{clinica}}* foi confirmado com sucesso!\n\n📎 Guia Oficial com QR Code: " + guideUrl;
    const confirmMessage = applyMessageVariables(rawTemplate, {
      nome: patientFirstName,
      clinica: clinicName,
      procedimento: procedureName,
    });

    await prisma.message.create({
      data: {
        conversationId,
        direction: "OUTBOUND",
        content: confirmMessage,
        status: "DELIVERED",
      },
    });

    whatsappService.sendMessage(conversation.contact.phone, confirmMessage, "appointment.confirmed.crm_kanban").catch(() => {});
  }

  revalidatePath("/clinic/inbox");
}

export async function updateConversationDepartment(conversationId: string, department: Department) {
  const { clinicId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { department: departmentToDb[department] },
  });
  revalidatePath("/clinic/inbox");
}

export async function suggestIaReply(conversationId: string) {
  const { clinicId } = await requireClinicSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      clinic: true,
      messages: { orderBy: { createdAt: "desc" }, take: 6 },
    },
  });

  if (!conversation || conversation.clinicId !== clinicId) {
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

  return `Olá, ${patientName}! 👋 Obrigado por entrar em contato com a ${conversation.clinic.tradeName}. Como posso te ajudar com o seu agendamento hoje?`;
}

export async function seedDemoConversations() {
  const clinic = await prisma.clinic.findFirst({
    where: { active: true },
    orderBy: { tradeName: "asc" },
  });

  if (!clinic) {
    throw new Error("Nenhuma clínica ativa encontrada para popular conversas de demonstração.");
  }

  const clinicId = clinic.id;

  // Conversa 1: Marcos Silva
  const contact1 = await prisma.contact.upsert({
    where: { phone: "77999881122" },
    update: { name: "Marcos Silva" },
    create: { phone: "77999881122", name: "Marcos Silva" },
  });

  await prisma.conversation.upsert({
    where: { id: "demo-conv-1" },
    update: { lastMessageAt: new Date() },
    create: {
      id: "demo-conv-1",
      clinicId,
      contactId: contact1.id,
      status: "OPEN",
      funnelStage: "TRIAGEM",
      department: "RECEPCAO",
      tags: ["Urologia", "Vasectomia"],
      lastMessageAt: new Date(),
      messages: {
        create: [
          {
            direction: "INBOUND",
            content: "Olá! Gostaria de saber os horários disponíveis para consulta com Urologista e informações sobre cirurgia de Vasectomia.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 60),
          },
          {
            direction: "OUTBOUND",
            content: "Olá Marcos! Atendemos na Urolaser com tabela especial Conecta Saúde sob consulta. O especialista em Urologia atende às terças e quintas.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 45),
          },
          {
            direction: "INBOUND",
            content: "Excelente! Quais documentos preciso levar no dia da primeira consulta?",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 30),
          },
          {
            direction: "OUTBOUND",
            content: "Traga documento com foto e a Guia Conecta Saúde gerada no app. Quer que eu reserve seu horário para esta quinta-feira?",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 20),
          },
          {
            direction: "OUTBOUND",
            type: "INTERNAL_NOTE",
            content: "🔒 Paciente prefere atendimento no turno da tarde.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 10),
          },
        ],
      },
    },
  });

  // Conversa 2: Dra. Camila Santos
  const contact2 = await prisma.contact.upsert({
    where: { phone: "77988773344" },
    update: { name: "Dra. Camila Santos" },
    create: { phone: "77988773344", name: "Dra. Camila Santos" },
  });

  await prisma.conversation.upsert({
    where: { id: "demo-conv-2" },
    update: { lastMessageAt: new Date() },
    create: {
      id: "demo-conv-2",
      clinicId,
      contactId: contact2.id,
      status: "OPEN",
      funnelStage: "NOVOS",
      department: "RECEPCAO",
      tags: ["Lead B2B", "Prioritário"],
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 5),
      messages: {
        create: [
          {
            direction: "INBOUND",
            content: "Boa tarde! Sou a Dra. Camila Santos, gestora do Centro Médico Choça. Gostaria de credenciar nossa unidade à Rede Conecta Saúde.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 40),
          },
          {
            direction: "OUTBOUND",
            content: "Olá Dra. Camila! Seja muito bem-vinda à Conecta Saúde. Nosso modelo de credenciamento sem mensalidade atende perfeitamente a região de Barra do Choça. Vamos agendar uma reunião comercial?",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 15),
          },
        ],
      },
    },
  });

  // Conversa 3: Maria Eduarda
  const contact3 = await prisma.contact.upsert({
    where: { phone: "77991223344" },
    update: { name: "Maria Eduarda" },
    create: { phone: "77991223344", name: "Maria Eduarda" },
  });

  await prisma.conversation.upsert({
    where: { id: "demo-conv-3" },
    update: { lastMessageAt: new Date() },
    create: {
      id: "demo-conv-3",
      clinicId,
      contactId: contact3.id,
      status: "OPEN",
      funnelStage: "AGENDADO",
      department: "AGENDAMENTO",
      tags: ["Ultrassom", "Jejum"],
      lastMessageAt: new Date(Date.now() - 1000 * 60 * 2),
      messages: {
        create: [
          {
            direction: "INBOUND",
            content: "Oi! Preciso confirmar os procedimentos para o meu exame de ultrassonografia amanhã de manhã na Santa Clara.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 50),
          },
          {
            direction: "OUTBOUND",
            content: "Olá Maria Eduarda! Seu exame de Ultrassom Abdominal está pré-agendado. Lembre-se de manter jejum de 8 horas e tomar 4 copos de água 1 hora antes do exame.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 25),
          },
          {
            direction: "OUTBOUND",
            type: "INTERNAL_NOTE",
            content: "🔒 Guia de agendamento gerada e enviada via WhatsApp.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 5),
          },
        ],
      },
    },
  });

  // Conversa 4: Juliana Rocha (Triagem IA / Fora de Horário)
  const contact4 = await prisma.contact.upsert({
    where: { phone: "77999887766" },
    update: { name: "Juliana Rocha", cpf: "098.765.432-11" },
    create: { phone: "77999887766", name: "Juliana Rocha", cpf: "098.765.432-11" },
  });

  await prisma.conversation.upsert({
    where: { id: "demo-conv-4" },
    update: { lastMessageAt: new Date() },
    create: {
      id: "demo-conv-4",
      clinicId,
      contactId: contact4.id,
      status: "OPEN",
      funnelStage: "TRIAGEM",
      department: "RECEPCAO",
      tags: ["⚡ Triado por IA", "🔬 Triagem Concluída", "Ginecologia"],
      lastMessageAt: new Date(),
      messages: {
        create: [
          {
            direction: "INBOUND",
            content: "Olá! Meu nome é Juliana Rocha, CPF 098.765.432-11. Preciso agendar uma consulta de Ginecologia e um preventivo.",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 15),
          },
          {
            direction: "OUTBOUND",
            content: "🤖 *TRIAGEM IA REALIZADA COM SUCESSO*\n\nObrigado pelas informações! Identificamos os dados do seu atendimento:\n• *CPF:* 098.765.432-11\n• *Interesse:* Ginecologia\n\nSua conversa foi movida para a *Fila de Atendimento Prioritário*. Um atendente da nossa recepção responderá em breve!",
            status: "DELIVERED",
            createdAt: new Date(Date.now() - 1000 * 60 * 14),
          },
        ],
      },
    },
  });

  revalidatePath("/admin/inbox");
  revalidatePath("/clinic/inbox");
  revalidatePath("/admin/crm");
  revalidatePath("/clinic/crm");
}
