"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { whatsappService } from "@/lib/whatsapp";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { departmentToDb, funnelStageToDb, toChatContact, toChatMessage } from "@/lib/chat-crm-adapters";
import type { Department, FunnelStage, InboxFilter } from "@/types/chat-crm";
import {
  sendMessageSchema,
  updateTagsSchema,
} from "@/lib/schemas/inbox";

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

export async function getChatMessagesAdmin(conversationId: string) {
  await requireAdminSession();
  const messages = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    include: { senderUser: { select: { id: true, name: true } } },
  });

  return messages.map(toChatMessage);
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
  whatsappService.sendMessage(conversation.contact.phone, data.content, "chat.outbound_admin").then((result) => {
    if (!result.success && !result.skipped) {
      prisma.message.update({
        where: { id: message.id },
        data: { status: "FAILED" },
      }).catch(() => {});
    }
  }).catch(() => {});

  revalidatePath("/admin/inbox");
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
