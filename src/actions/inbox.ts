"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { whatsappService } from "@/lib/whatsapp";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
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

export async function sendMessage(conversationId: string, content: string) {
  const { clinicId, userId } = await requireClinicSession();
  const data = sendMessageSchema.parse({ conversationId, content });

  const conversation = await prisma.conversation.findUnique({
    where: { id: data.conversationId },
    include: { contact: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
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

  revalidatePath("/clinic/inbox");
  return updated;
}

export async function assignConversationToMe(conversationId: string) {
  const { clinicId, userId } = await requireClinicSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true },
  });
  if (!conversation || conversation.clinicId !== clinicId) {
    throw new Error("Conversa não encontrada");
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: userId },
  });
  revalidatePath("/clinic/inbox");
}

export async function resolveConversation(conversationId: string) {
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
    data: { status: "RESOLVED" },
  });
  revalidatePath("/clinic/inbox");
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
  const items = await prisma.clinicProcedure.findMany({
    where: { clinicId },
    include: { procedure: true },
    orderBy: { procedure: { name: "asc" } },
  });
  return items.map(toPlainClinicProcedureItem);
}

export async function listCannedResponses() {
  const { clinicId } = await requireClinicSession();
  return prisma.cannedResponse.findMany({
    where: { OR: [{ clinicId }, { clinicId: null }] },
    orderBy: { shortcut: "asc" },
  });
}
