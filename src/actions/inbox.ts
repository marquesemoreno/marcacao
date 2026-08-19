"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { whatsappService } from "@/lib/whatsapp";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { toChatContact, toChatMessage, departmentToDb, funnelStageToDb } from "@/lib/chat-crm-adapters";
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

export async function getChatMessages(conversationId: string) {
  const conversation = await getConversation(conversationId);
  return conversation.messages.map(toChatMessage);
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
