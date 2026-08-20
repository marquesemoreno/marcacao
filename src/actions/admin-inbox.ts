"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { whatsappService } from "@/lib/whatsapp";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { toChatContact, toChatMessage, departmentToDb, funnelStageToDb } from "@/lib/chat-crm-adapters";
import type { Department, FunnelStage, InboxFilter } from "@/types/chat-crm";
import { applyMessageVariables, getBaseUrl } from "@/lib/format";
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

export async function claimConversationAdmin(conversationId: string) {
  const { userId } = await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { assignedUser: { select: { id: true, name: true } } },
  });

  if (!conversation) {
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
  const userName = currentUser?.name || "Administrador";
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

  revalidatePath("/admin/inbox");
  revalidatePath("/admin/crm");
  return { success: true };
}

export async function transferConversationAdmin(
  conversationId: string,
  targetUserId: string,
  department?: Department
) {
  const { userId } = await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { id: true },
  });

  if (!conversation) {
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

  revalidatePath("/admin/inbox");
  revalidatePath("/admin/crm");
  return { success: true };
}

export async function assignConversationToUserAdmin(conversationId: string, targetUserId: string) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { assignedUserId: targetUserId },
  });
  revalidatePath("/admin/inbox");
}

const REASON_LABELS_ADMIN: Record<string, string> = {
  AGENDAMENTO_CONCLUIDO: "🎟️ Agendamento Concluído",
  DUVIDA_ESCLARECIDA: "💡 Dúvida Esclarecida / Informações",
  ORCAMENTO_ENVIADO: "💲 Orçamento Enviado",
  SEM_RESPOSTA: "⏳ Paciente Não Respondeu / Inativo",
  CANCELAMENTO: "❌ Cancelamento / Desistência",
  ENCAMINHADO: "🔄 Encaminhado para Outro Setor",
};

export async function resolveConversationAdmin(
  conversationId: string,
  resolutionData?: { reason: string; notes?: string }
) {
  const { userId } = await requireAdminSession();

  const currentUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true },
  });
  const userName = currentUser?.name || "Administrador";
  const reasonKey = resolutionData?.reason || "DUVIDA_ESCLARECIDA";
  const reasonLabel = REASON_LABELS_ADMIN[reasonKey] || reasonKey;

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

  revalidatePath("/admin/inbox");
  revalidatePath("/admin/crm");
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
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, clinic: true },
  });

  if (!conversation) {
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

    whatsappService.sendMessage(conversation.contact.phone, confirmMessage, "appointment.confirmed.crm_kanban_admin").catch(() => {});
  }

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

export async function suggestIaReplyAdmin(conversationId: string) {
  await requireAdminSession();
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      clinic: true,
      messages: { orderBy: { createdAt: "desc" }, take: 6 },
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
