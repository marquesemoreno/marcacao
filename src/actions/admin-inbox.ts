"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { whatsappService } from "@/lib/whatsapp";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { toChatContact, toChatMessage, departmentToDb, funnelStageToDb } from "@/lib/chat-crm-adapters";
import type { Department, FunnelStage, InboxFilter } from "@/types/chat-crm";
import { sendMessageSchema, updateTagsSchema, type ConversationFilter } from "@/lib/schemas/inbox";

/**
 * Equivalente de src/actions/inbox.ts, mas para o painel Admin: enxerga
 * conversas de TODAS as clínicas (sem o `where: { clinicId }` que o
 * requireClinicSession() impõe), protegido por requireAdminSession().
 * Mantidas como um módulo separado (em vez de um parâmetro opcional em
 * inbox.ts) porque o contrato de autorização é fundamentalmente diferente:
 * aqui não existe "essa conversa pertence à minha clínica" para checar.
 */

const ACTIVE_STATUSES: ConversationStatus[] = [ConversationStatus.OPEN, ConversationStatus.PENDING];

export async function listConversationsAdmin(filter: ConversationFilter, search?: string) {
  const { userId } = await requireAdminSession();

  const where =
    filter === "mine"
      ? { assignedUserId: userId, status: { in: ACTIVE_STATUSES } }
      : filter === "unassigned"
        ? { assignedUserId: null, status: { in: ACTIVE_STATUSES } }
        : filter === "resolved"
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
      assignedUser: { select: { id: true, name: true } },
      clinic: { select: { id: true, tradeName: true } },
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

export async function getConversationAdmin(conversationId: string) {
  await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      assignedUser: { select: { id: true, name: true } },
      clinic: { select: { id: true, tradeName: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        include: { senderUser: { select: { id: true, name: true } } },
      },
    },
  });

  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  return conversation;
}

export async function sendMessageAdmin(conversationId: string, content: string, isInternalNote = false) {
  const { userId } = await requireAdminSession();
  const data = sendMessageSchema.parse({ conversationId, content });

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
      status: "PENDING",
      senderUserId: userId,
    },
  });

  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN" },
  });

  const result = await whatsappService.sendMessage(conversation.contact.phone, data.content, "chat.outbound");

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: { status: result.skipped ? "PENDING" : result.success ? "SENT" : "FAILED" },
  });

  revalidatePath("/admin/inbox");
  return updated;
}

export async function assignConversationToUserAdmin(conversationId: string, targetUserId: string) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: targetUserId },
  });
  revalidatePath("/admin/inbox");
}

export async function resolveConversationAdmin(conversationId: string) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "RESOLVED" },
  });
  revalidatePath("/admin/inbox");
}

export async function reopenConversationAdmin(conversationId: string) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { status: "OPEN" },
  });
  revalidatePath("/admin/inbox");
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
}

export async function updateConversationDepartmentAdmin(conversationId: string, department: Department) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { department: departmentToDb[department] },
  });
  revalidatePath("/admin/inbox");
}

/** Catálogo de procedimentos de UMA clínica específica — o Admin escolhe
 * implicitamente a clínica ao abrir o agendamento a partir de uma conversa
 * (cada conversa já pertence a uma única clínica). */
export async function listClinicProceduresForAppointmentAdmin(clinicId: string) {
  await requireAdminSession();
  const items = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: { procedure: true },
    orderBy: { procedure: { name: "asc" } },
  });
  return items.map(toPlainClinicProcedureItem);
}

/** Só as respostas rápidas globais — as por-clínica (endereço) dependem de
 * qual conversa está selecionada, e o Admin transita entre clínicas diferentes. */
export async function listCannedResponsesAdmin() {
  await requireAdminSession();
  return prisma.cannedResponse.findMany({
    where: { clinicId: null },
    orderBy: { shortcut: "asc" },
  });
}

const INBOX_FILTER_TO_CONVERSATION_FILTER: Record<InboxFilter, ConversationFilter> = {
  minhas: "mine",
  nao_atribuidas: "unassigned",
  todas: "all",
  finalizadas: "resolved",
};

export async function listChatContactsAdmin(filter: InboxFilter, search?: string) {
  const conversations = await listConversationsAdmin(INBOX_FILTER_TO_CONVERSATION_FILTER[filter], search);
  return conversations.map(toChatContact);
}

export async function getChatMessagesAdmin(conversationId: string) {
  const conversation = await getConversationAdmin(conversationId);
  return conversation.messages.map(toChatMessage);
}

export async function listChatAgentsAdmin() {
  await requireAdminSession();
  const users = await prisma.user.findMany({
    where: { role: { in: ["CLINIC", "ADMIN"] } },
    select: { id: true, name: true, role: true, clinic: { select: { tradeName: true } } },
    orderBy: { name: "asc" },
  });
  return users.map((user) => ({
    id: user.id,
    name: user.name,
    avatar: "",
    role: user.role === "ADMIN" ? "Administração" : (user.clinic?.tradeName ?? "Equipe da clínica"),
  }));
}

/** Histórico do paciente em QUALQUER clínica (o Admin enxerga a rede toda),
 * casado por telefone — mesma limitação de Appointment não ter FK para
 * Contact documentada em src/actions/inbox.ts. */
export async function getChatContactHistoryAdmin(conversationId: string) {
  await requireAdminSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contact: { select: { phone: true } } },
  });
  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  const appointments = await prisma.appointment.findMany({
    where: { patientPhone: conversation.contact.phone },
    include: { clinicProcedure: { include: { procedure: true, clinic: { select: { tradeName: true } } } } },
    orderBy: { date: "desc" },
    take: 10,
  });

  const statusMap = { PENDING: "agendada", CONFIRMED: "agendada", COMPLETED: "concluida", CANCELLED: "cancelada", NO_SHOW: "cancelada" } as const;

  return appointments.map((appointment) => ({
    id: appointment.id,
    specialty: appointment.clinicProcedure.procedure.name,
    doctor: appointment.clinicProcedure.clinic.tradeName,
    date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(appointment.date),
    status: statusMap[appointment.status],
    price: undefined,
  }));
}
