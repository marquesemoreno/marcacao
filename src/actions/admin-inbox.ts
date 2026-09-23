"use server";

import { revalidatePath } from "next/cache";
import { ConversationStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { whatsappService, sendWhatsAppMedia, sendWhatsAppAudio, sendWhatsAppContact, sendWhatsAppReaction, formatToWhatsAppNumber, isValidWhatsAppNumber, fetchWhatsAppProfilePicture, editWhatsAppMessage, type QuotedMessageRef } from "@/lib/whatsapp";
import { canEditMessage } from "@/lib/message-edit";
import { hasHospitalBridgeIntegration, fetchBridgeProcedures, fetchBridgeDoctors, fetchBridgeAgenda, fetchBridgeConvenios, fetchBridgePatients, adaptBridgeProcedureToPlainItem } from "@/lib/hospital-bridge";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { departmentToDb, funnelStageToDb, toChatContact, toChatMessage } from "@/lib/chat-crm-adapters";
import { attachSignedUrls, uploadWhatsAppMedia, getSignedMediaUrl, downloadWhatsAppMedia, formatDuration } from "@/lib/whatsapp-media";
import { transcribeAudio } from "@/lib/ai-transcription";
import { generateReplySuggestions } from "@/lib/ai-copilot";
import { formatFileSize, formatPhone, formatCurrency } from "@/lib/format";
import { createGlpiTicket, buildGlpiTicketUrl, listGlpiEntities } from "@/lib/glpi";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { isTeamQueueUser, formatAgentDisplayName } from "@/lib/team-queue";
import { assignmentSeenAtFor } from "@/lib/conversation-assignment";
import { getAiAttendantConfig } from "@/lib/ai-attendant";
import { analyzeConversationQuality } from "@/lib/conversation-quality";
import { extractInvoiceData, type InvoiceData } from "@/lib/invoice-extraction";
import { mentionsInvoiceRequest } from "@/lib/chat-messages";
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

/** Mirror admin de listForwardTargets (inbox.ts) — sem clínica própria na sessão,
 * a restrição "mesma clínica" vem da clínica da CONVERSA DE ORIGEM. */
export async function listForwardTargetsAdmin(sourceConversationId: string, search?: string) {
  await requireAdminSession();

  const source = await prisma.conversation.findUnique({
    where: { id: sourceConversationId },
    select: { clinicId: true },
  });
  if (!source) throw new Error("Conversa não encontrada");

  const conversations = await prisma.conversation.findMany({
    where: {
      clinicId: source.clinicId,
      id: { not: sourceConversationId },
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
    include: { contact: true },
    orderBy: { contact: { name: "asc" } },
    take: 30,
  });

  return conversations.map((conversation) => ({
    conversationId: conversation.id,
    name: conversation.contact.name,
    phone: conversation.contact.phone,
  }));
}

export async function listChatContactsAdmin(filter: InboxFilter, search?: string, clinicId?: string) {
  const { userId } = await requireAdminSession();

  // Com busca ativa, ignora o filtro de aba e procura em todas as conversas —
  // ver o mesmo comentário em listConversations (inbox.ts).
  const where = search
    ? { archivedAt: filter === "arquivadas" ? { not: null } : null }
    : filter === "arquivadas"
      ? { archivedAt: { not: null } }
      : filter === "minhas"
        ? { status: { in: ACTIVE_STATUSES }, archivedAt: null }
        : filter === "nao_atribuidas"
          ? { assignedUserId: null, status: { in: ACTIVE_STATUSES }, archivedAt: null }
          : filter === "finalizadas"
            ? { status: ConversationStatus.RESOLVED, archivedAt: null }
            : { status: { in: ACTIVE_STATUSES }, archivedAt: null };

  const conversations = await prisma.conversation.findMany({
    where: {
      ...where,
      ...(clinicId ? { clinicId } : {}),
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
      // take: 3 (não 1) — a prévia da lista pula nota interna e mostra a última
      // mensagem de verdade (ver toChatContact em chat-crm-adapters.ts).
      // select explícito (não a linha inteira): essa lista não pagina e é pollada
      // a cada 30s (ver useInboxRealtime) — trazer mediaPath/whatsappKeyId/etc. de
      // 3 mensagens por conversa, pra TODAS as conversas, a cada ciclo, foi um dos
      // motivos do Egress do Supabase estourar de novo.
      messages: {
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { type: true, content: true, mimeType: true, createdAt: true, direction: true },
      },
    },
    orderBy: { lastMessageAt: "desc" },
  });

  // Em lotes de 2000 IDs por vez — o Postgres rejeita a query acima de ~32767
  // parâmetros de bind, e sem o filtro de clínica (ex: "Todas as Clínicas") a
  // lista de conversas pode facilmente passar disso.
  const conversationIds = conversations.map((c) => c.id);
  const unreadByConversation = new Map<string, number>();
  for (let i = 0; i < conversationIds.length; i += 2000) {
    const chunk = conversationIds.slice(i, i + 2000);
    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: chunk },
        direction: "INBOUND",
        readAt: null,
      },
      _count: { id: true },
    });
    for (const u of unreadCounts) unreadByConversation.set(u.conversationId, u._count.id);
  }

  return conversations.map((c) =>
    toChatContact(
      {
        ...c,
        unreadCount: unreadByConversation.get(c.id) ?? 0,
      },
      userId
    )
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
  if (!isValidWhatsAppNumber(fullPhone)) {
    throw new Error("Telefone inválido. Informe com DDD e 9 dígitos (ex: 77999998888).");
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
  notifyInboxRealtime(clinicId).catch(() => {});
  return conversation.id;
}

export type ImportContactsResult = {
  imported: number;
  skipped: { name: string; phone: string; reason: string }[];
};

/** Importação em massa (ver "Importar Contatos" em contacts-app.tsx) — só cadastra
 * o Contact (agenda de contatos), sem criar Conversation. Diferente do botão
 * "Cadastrar novo contato e iniciar conversa" (createContactAdmin), aqui o objetivo
 * é só ter o número na base pra futuros disparos/atendimento — criar uma Conversation
 * "OPEN" por linha lotava a fila de atendimento com milhares de conversas vazias
 * (sem nenhuma mensagem) numa importação grande. A Conversation nasce naturalmente
 * quando o contato manda a primeira mensagem de verdade (fluxo do webhook). Uma
 * linha com nome/telefone inválido é reportada em `skipped`, não aborta a
 * importação das demais. */
export async function importContactsAdmin(
  clinicId: string,
  rows: { name: string; phone: string; cpf?: string }[]
): Promise<ImportContactsResult> {
  await requireAdminSession();

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
  if (!clinic) throw new Error("Clínica não encontrada");

  const skipped: ImportContactsResult["skipped"] = [];
  let imported = 0;

  for (const row of rows) {
    const trimmedName = row.name.trim();
    if (trimmedName.length < 2) {
      skipped.push({ name: row.name, phone: row.phone, reason: "Nome inválido" });
      continue;
    }
    const fullPhone = formatToWhatsAppNumber(row.phone);
    if (!isValidWhatsAppNumber(fullPhone)) {
      skipped.push({ name: row.name, phone: row.phone, reason: "Telefone inválido" });
      continue;
    }

    await prisma.contact.upsert({
      where: { phone: fullPhone },
      update: row.cpf?.trim() ? { cpf: row.cpf.trim() } : {},
      create: { phone: fullPhone, name: trimmedName, cpf: row.cpf?.trim() || null },
    });
    imported++;
  }

  revalidatePath("/admin/contatos");
  return { imported, skipped };
}

/** Corrige a clínica de uma conversa que caiu na atribuição automática errada
 * (webhook do WhatsApp usa a 1ª clínica cadastrada como fallback quando não
 * acha agendamento pendente/confirmado pro telefone — ver route.ts). */
export async function updateConversationClinicAdmin(conversationId: string, clinicId: string) {
  await requireAdminSession();
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { id: true } });
  if (!clinic) throw new Error("Clínica não encontrada");

  const previous = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { clinicId: true } });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { clinicId },
  });
  revalidatePath("/admin/inbox");
  // Avisa as duas clínicas — a conversa sai da fila de uma e entra na da outra.
  notifyInboxRealtime(clinicId).catch(() => {});
  if (previous && previous.clinicId !== clinicId) {
    notifyInboxRealtime(previous.clinicId).catch(() => {});
  }
}

export async function listChatAgentsAdmin() {
  await requireAdminSession();
  const users = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "CLINIC"] }, active: true },
    select: { id: true, name: true, role: true, clinic: { select: { tradeName: true } } },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    id: u.id,
    // Lista mistura várias clínicas — passa o nome da clínica pra não mostrar
    // "Não Atribuídas" repetido sem dizer de qual fila é cada uma.
    name: formatAgentDisplayName(u.name, u.clinic?.tradeName),
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
    include: {
      senderUser: { select: { id: true, name: true } },
      quotedMessage: { include: { senderUser: { select: { id: true, name: true } } } },
    },
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
    include: {
      senderUser: { select: { id: true, name: true } },
      quotedMessage: { include: { senderUser: { select: { id: true, name: true } } } },
    },
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
  const todayUtc = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00.000Z");

  return appointments.map((a) => {
    const effectivePrice = a.clinicProcedure.promotionalPrice ?? a.clinicProcedure.price;
    return {
      id: a.id,
      specialty: a.clinicProcedure.procedure.name,
      doctor: a.clinicProcedure.clinic.tradeName,
      date: new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(a.date),
      status: statusMap[a.status],
      price: Number(effectivePrice) > 0 ? formatCurrency(effectivePrice.toString()) : undefined,
      preparationInstructions: a.clinicProcedure.procedure.preparationInstructions ?? undefined,
      isUpcoming: a.date.getTime() >= todayUtc.getTime() && (a.status === "PENDING" || a.status === "CONFIRMED"),
    };
  });
}

/** Mesma lógica de resolveQuotedRef em inbox.ts (ver ali o porquê) — duplicada aqui
 * seguindo o padrão dual clínica/admin já usado no resto do arquivo. */
async function resolveQuotedRefAdmin(
  conversationId: string,
  contactPhone: string,
  replyToMessageId: string | undefined
): Promise<QuotedMessageRef | undefined> {
  if (!replyToMessageId) return undefined;
  const quoted = await prisma.message.findUnique({ where: { id: replyToMessageId } });
  if (!quoted || quoted.conversationId !== conversationId || !quoted.whatsappKeyId) return undefined;
  return {
    keyId: quoted.whatsappKeyId,
    remoteJid: `${formatToWhatsAppNumber(contactPhone)}@s.whatsapp.net`,
    fromMe: quoted.direction === "OUTBOUND",
  };
}

export async function sendMessageAdmin(
  conversationId: string,
  content: string,
  isInternalNote?: boolean,
  replyToMessageId?: string
) {
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
    notifyInboxRealtime(conversation.clinicId).catch(() => {});
    return note;
  }

  const quotedRef = await resolveQuotedRefAdmin(data.conversationId, conversation.contact.phone, replyToMessageId);

  const message = await prisma.message.create({
    data: {
      conversationId: data.conversationId,
      direction: "OUTBOUND",
      content: data.content,
      status: "SENT",
      senderUserId: userId,
      quotedMessageId: quotedRef ? replyToMessageId : null,
    },
  });

  await prisma.conversation.update({
    where: { id: data.conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN", aiEnabled: false },
  });

  // Precisa esperar o envio de verdade (não fire-and-forget) — ver comentário na
  // versão clínica (sendMessage, inbox.ts): numa função serverless o processo pode
  // ser encerrado antes do ".then()" salvar o whatsappKeyId, e sem ele a mensagem
  // nunca fica editável nem casa os acks de entrega/leitura.
  try {
    const result = await whatsappService.sendMessage(conversation.contact.phone, data.content, "chat.outbound_admin", conversation.clinicId, quotedRef);
    if (!result.success && !result.skipped) {
      await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } });
    } else if (result.keyId) {
      await prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } });
    }
  } catch {
    await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(conversation.clinicId).catch(() => {});
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
    data: { lastMessageAt: new Date(), status: "OPEN", aiEnabled: false },
  });

  const signedUrl = await getSignedMediaUrl(uploaded.path);
  if (signedUrl) {
    // Await por robustez, não fire-and-forget — ver comentário em sendMessageAdmin.
    try {
      const result = await sendWhatsAppMedia(conversation.contact.phone, signedUrl, file.type, file.name, "", "chat.outbound_admin.media", conversation.clinicId);
      if (!result.success && !result.skipped) {
        await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } });
      } else if (result.keyId) {
        await prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } });
      }
    } catch {
      await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(conversation.clinicId).catch(() => {});
  return message;
}

/** Mirror admin de sendAudioMessage (inbox.ts) — sem checagem de clínica, igual aos outros mirrors. */
export async function sendAudioMessageAdmin(conversationId: string, formData: FormData) {
  const { userId } = await requireAdminSession();

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
  if (!conversation) {
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
    data: { lastMessageAt: new Date(), status: "OPEN", aiEnabled: false },
  });

  const signedUrl = await getSignedMediaUrl(uploaded.path);
  if (signedUrl) {
    try {
      const result = await sendWhatsAppAudio(conversation.contact.phone, signedUrl, "chat.outbound_admin.audio", conversation.clinicId);
      if (!result.success && !result.skipped) {
        await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } });
      } else if (result.keyId) {
        await prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } });
      }
    } catch {
      await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
    }
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(conversation.clinicId).catch(() => {});
  return message;
}

/** Mirror admin de shareContact (inbox.ts) — sem checagem de clínica. */
export async function shareContactAdmin(conversationId: string, target?: { name: string; phone: string }) {
  const { userId } = await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: { contact: true, clinic: true },
  });
  if (!conversation) {
    throw new Error("Conversa não encontrada");
  }

  const contactName = target?.name ?? conversation.clinic.tradeName;
  const contactPhone = target?.phone ?? (conversation.clinic.phone ?? conversation.clinic.whatsapp);
  if (!contactPhone) {
    throw new Error(target ? "Contato sem telefone cadastrado." : "Clínica sem telefone cadastrado.");
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      content: `${contactName} — ${contactPhone}`,
      status: "SENT",
      type: "CONTACT",
      senderUserId: userId,
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { lastMessageAt: new Date(), status: "OPEN", aiEnabled: false },
  });

  try {
    const result = await sendWhatsAppContact(
      conversation.contact.phone,
      contactName,
      contactPhone,
      "chat.outbound_admin.contact",
      conversation.clinicId
    );
    if (!result.success && !result.skipped) {
      await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } });
    } else if (result.keyId) {
      await prisma.message.update({ where: { id: message.id }, data: { whatsappKeyId: result.keyId } });
    }
  } catch {
    await prisma.message.update({ where: { id: message.id }, data: { status: "FAILED" } }).catch(() => {});
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(conversation.clinicId).catch(() => {});
  return message;
}

/** Mirror admin de toggleReaction (inbox.ts) — sem checagem de clínica. */
export async function toggleReactionAdmin(messageId: string, emoji: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) {
    throw new Error("Mensagem não encontrada");
  }
  if (!message.whatsappKeyId) {
    throw new Error("Essa mensagem nunca chegou a sincronizar com o WhatsApp.");
  }

  const isRemoving = message.agentReaction === emoji;
  const target: QuotedMessageRef = {
    keyId: message.whatsappKeyId,
    remoteJid: `${formatToWhatsAppNumber(message.conversation.contact.phone)}@s.whatsapp.net`,
    fromMe: message.direction === "OUTBOUND",
  };

  const result = await sendWhatsAppReaction(target, isRemoving ? "" : emoji, "chat.outbound_admin.reaction", message.conversation.clinicId);
  if (!result.success && !result.skipped) {
    throw new Error("Não foi possível enviar a reação.");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { agentReaction: isRemoving ? null : emoji },
  });

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(message.conversation.clinicId).catch(() => {});
  return updated;
}

/** Mirror admin de toggleStarred (inbox.ts) — sem checagem de clínica. */
export async function toggleStarredAdmin(messageId: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    throw new Error("Mensagem não encontrada");
  }

  const updated = await prisma.message.update({
    where: { id: messageId },
    data: { starredAt: message.starredAt ? null : new Date() },
  });

  revalidatePath("/admin/inbox");
  return updated;
}

/** Mirror admin de forwardMessage (inbox.ts) — restrição "mesma clínica" vem da
 * clínica de origem/destino comparadas entre si (sem clínica própria na sessão). */
export async function forwardMessageAdmin(messageId: string, targetConversationId: string) {
  await requireAdminSession();

  const source = await prisma.message.findUnique({ where: { id: messageId } });
  if (!source) {
    throw new Error("Mensagem não encontrada");
  }
  const [sourceConv, targetConv] = await Promise.all([
    prisma.conversation.findUnique({ where: { id: source.conversationId }, select: { clinicId: true } }),
    prisma.conversation.findUnique({ where: { id: targetConversationId }, select: { clinicId: true } }),
  ]);
  if (!sourceConv || !targetConv || sourceConv.clinicId !== targetConv.clinicId) {
    throw new Error("Só é possível encaminhar entre conversas da mesma clínica.");
  }

  if (source.type === "INTERNAL_NOTE") {
    throw new Error("Nota interna não pode ser encaminhada.");
  }

  if (source.type === "TEXT") {
    return sendMessageAdmin(targetConversationId, source.content);
  }

  if (source.type === "CONTACT") {
    const [name, phone] = source.content.split(" — ");
    return shareContactAdmin(targetConversationId, { name, phone });
  }

  if (!source.mediaPath || !source.mimeType) {
    throw new Error("Arquivo original não encontrado para encaminhar.");
  }
  const buffer = await downloadWhatsAppMedia(source.mediaPath);
  if (!buffer) {
    throw new Error("Não foi possível baixar o arquivo original.");
  }
  const fileName = source.attachmentName || `arquivo.${source.mimeType.split("/")[1] || "bin"}`;
  const file = new File([new Uint8Array(buffer)], fileName, { type: source.mimeType });
  const formData = new FormData();
  formData.append("file", file);

  if (source.type === "AUDIO") {
    const [minutes, seconds] = (source.audioDuration || "0:00").split(":").map(Number);
    formData.append("duration", String((minutes || 0) * 60 + (seconds || 0)));
    return sendAudioMessageAdmin(targetConversationId, formData);
  }
  return sendMediaMessageAdmin(targetConversationId, formData);
}

/** Reenvia uma mensagem OUTBOUND que falhou (texto, anexo ou áudio) — ver resendMessage (inbox.ts). */
export async function resendMessageAdmin(messageId: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) return { success: false as const, error: "Mensagem não encontrada" };
  if (message.direction !== "OUTBOUND" || message.type === "INTERNAL_NOTE") {
    return { success: false as const, error: "Essa mensagem não pode ser reenviada." };
  }

  await prisma.message.update({ where: { id: messageId }, data: { status: "SENT" } });
  const phone = message.conversation.contact.phone;
  const clinicId = message.conversation.clinicId;

  if (message.type === "ATTACHMENT" || message.type === "AUDIO") {
    if (!message.mediaPath) {
      return { success: false as const, error: "Arquivo original não encontrado para reenviar." };
    }
    const signedUrl = await getSignedMediaUrl(message.mediaPath);
    if (!signedUrl) {
      return { success: false as const, error: "Não foi possível gerar o link do arquivo." };
    }

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
      return { success: false as const, error: "Falha ao reenviar. Verifique se o número do contato está correto." };
    }
    if (result.keyId) {
      await prisma.message.update({ where: { id: messageId }, data: { whatsappKeyId: result.keyId } });
    }
  } else {
    const result = await whatsappService.sendMessage(phone, message.content, "chat.retry_admin", clinicId);
    if (!result.success && !result.skipped) {
      await prisma.message.update({ where: { id: messageId }, data: { status: "FAILED" } });
      return { success: false as const, error: "Falha ao reenviar. Verifique se o número do contato está correto." };
    }
    if (result.keyId) {
      await prisma.message.update({ where: { id: messageId }, data: { whatsappKeyId: result.keyId } });
    }
  }

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(clinicId).catch(() => {});
  return { success: true as const };
}

/** Ver editMessage (actions/inbox.ts) — mesma regra, sem exigir uma clínica
 * dona da sessão (o admin enxerga conversas de todas). */
export async function editMessageAdmin(messageId: string, newText: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({
    where: { id: messageId },
    include: { conversation: { include: { contact: true } } },
  });
  if (!message) {
    return { success: false as const, error: "Mensagem não encontrada." };
  }

  const check = canEditMessage(message);
  if (!check.ok) {
    return { success: false as const, error: check.reason };
  }

  const trimmed = newText.trim();
  if (!trimmed) {
    return { success: false as const, error: "A mensagem não pode ficar vazia." };
  }
  if (trimmed === message.content) {
    return { success: true as const };
  }

  const result = await editWhatsAppMessage(
    message.conversation.contact.phone,
    message.whatsappKeyId!,
    trimmed,
    "chat.edit_admin",
    message.conversation.clinicId
  );
  if (!result.success && !result.skipped) {
    return { success: false as const, error: "Não foi possível editar no WhatsApp. Tente novamente." };
  }

  await prisma.message.update({ where: { id: messageId }, data: { content: trimmed, editedAt: new Date() } });
  revalidatePath("/admin/inbox");
  notifyInboxRealtime(message.conversation.clinicId).catch(() => {});
  return { success: true as const };
}

/** Espelho de transcribeMessageAudio (src/actions/inbox.ts) pro escopo admin. */
export async function transcribeMessageAudioAdmin(messageId: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    return { success: false as const, error: "Mensagem não encontrada." };
  }
  if (message.type !== "AUDIO" || !message.mediaPath) {
    return { success: false as const, error: "Esta mensagem não tem áudio pra transcrever." };
  }
  if (message.transcription) {
    return { success: true as const, transcription: message.transcription };
  }

  const buffer = await downloadWhatsAppMedia(message.mediaPath);
  if (!buffer) {
    return { success: false as const, error: "Não consegui baixar o áudio pra transcrever." };
  }

  const transcription = await transcribeAudio(buffer, message.mimeType || "audio/ogg");
  if (!transcription) {
    return { success: false as const, error: "Não foi possível transcrever esse áudio. Tente de novo." };
  }

  await prisma.message.update({ where: { id: messageId }, data: { transcription } });
  return { success: true as const, transcription };
}

/** Espelho de extractMessageInvoiceData (src/actions/inbox.ts) pro escopo admin. */
export async function extractMessageInvoiceDataAdmin(messageId: string) {
  await requireAdminSession();

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) {
    return { success: false as const, error: "Mensagem não encontrada." };
  }
  if (!mentionsInvoiceRequest(message.content)) {
    return { success: false as const, error: "Esta mensagem não parece ser um pedido de nota fiscal." };
  }
  if (message.extractedInvoiceData) {
    return { success: true as const, data: message.extractedInvoiceData as InvoiceData };
  }

  const data = await extractInvoiceData(message.content);
  if (!data) {
    return { success: false as const, error: "Não foi possível extrair dados dessa mensagem. Tente de novo." };
  }

  await prisma.message.update({ where: { id: messageId }, data: { extractedInvoiceData: data } });
  return { success: true as const, data };
}

/** Espelho de getReplySuggestions (src/actions/inbox.ts) pro escopo admin. */
export async function getReplySuggestionsAdmin(conversationId: string, quotedMessageContent?: string): Promise<string[]> {
  await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { clinicId: true, clinic: { select: { tradeName: true, name: true } } },
  });
  if (!conversation) return [];

  return generateReplySuggestions(
    conversationId,
    conversation.clinicId,
    conversation.clinic.tradeName || conversation.clinic.name,
    quotedMessageContent
  );
}

/** Abre um chamado no GLPI (help desk interno da TIVDC) a partir da última
 * mensagem do paciente nessa conversa — decisão manual do atendente (botão
 * "Abrir Chamado no GLPI" no menu da conversa), nunca automático. Ver
 * src/lib/glpi.ts pro cliente da API em si; aqui só monta nome/conteúdo do
 * chamado e registra o resultado como nota interna na conversa. */
export async function openGlpiTicketAdmin(conversationId: string) {
  await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      contact: true,
      messages: {
        where: { type: { not: "INTERNAL_NOTE" }, direction: "INBOUND", deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true },
      },
    },
  });
  if (!conversation) {
    return { success: false as const, error: "Conversa não encontrada." };
  }

  const lastInbound = conversation.messages[0]?.content?.trim();
  if (!lastInbound) {
    return { success: false as const, error: "Não há mensagem do paciente nessa conversa pra virar chamado." };
  }

  const firstLine = lastInbound.split("\n")[0].trim();
  const name = firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine || "Solicitação via WhatsApp";
  const content = `Chamado aberto a partir de uma conversa do WhatsApp.\nContato: ${conversation.contact.name} (${formatPhone(conversation.contact.phone)})\n\nMensagem do paciente:\n${lastInbound}`;

  const result = await createGlpiTicket(name, content, conversation.contact.glpiEntityId ?? undefined);

  if (result.success) {
    const ticketUrl = buildGlpiTicketUrl(result.ticketId);
    await prisma.message.create({
      data: {
        conversationId,
        direction: "OUTBOUND",
        type: "INTERNAL_NOTE",
        content: `🎫 Chamado #${result.ticketId} aberto no GLPI.${ticketUrl ? ` ${ticketUrl}` : ""}`,
        status: "SENT",
      },
    });
    revalidatePath("/admin/inbox");
    notifyInboxRealtime(conversation.clinicId).catch(() => {});
  }

  return result;
}

/** Lista as empresas (entidades) cadastradas no GLPI, pro admin vincular um contato
 * (ver updateContactGlpiEntity) — usado só na conversa do TIVDC. */
export async function listGlpiEntitiesAdmin() {
  await requireAdminSession();
  return listGlpiEntities();
}

/** Vincula (ou desvincula, com `glpiEntityId: null`) o contato dessa conversa a uma
 * empresa do GLPI — todo chamado aberto depois disso (manual ou pela IA) já cai na
 * entidade certa. `conversationId` (não o id do Contact) pelo mesmo motivo de
 * updateContactInfoAdmin: é o que a tela tem em mãos (ver Contact.id em chat-crm.ts). */
export async function updateContactGlpiEntity(conversationId: string, glpiEntityId: number | null) {
  await requireAdminSession();
  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId }, select: { contactId: true } });
  if (!conversation) return { success: false as const, error: "Conversa não encontrada." };
  await prisma.contact.update({ where: { id: conversation.contactId }, data: { glpiEntityId } });
  revalidatePath("/admin/inbox");
  return { success: true as const };
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

/** Idem — sem clinicId porque o admin enxerga conversas de todas as clínicas. */
export async function getOldestUnassignedWaitMinutesAdmin() {
  await requireAdminSession();
  const oldest = await prisma.conversation.findFirst({
    where: { assignedUserId: null, status: { in: ACTIVE_STATUSES } },
    orderBy: { lastMessageAt: "asc" },
    select: { lastMessageAt: true },
  });
  if (!oldest?.lastMessageAt) return null;
  return Math.floor((Date.now() - oldest.lastMessageAt.getTime()) / 60000);
}

export async function assignConversationToUserAdmin(conversationId: string, targetUserId: string | null) {
  const { userId } = await requireAdminSession();
  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      assignedUserId: targetUserId,
      status: "OPEN",
      assignmentSeenAt: targetUserId ? assignmentSeenAtFor(targetUserId, userId) : null,
    },
    select: { clinicId: true },
  });
  revalidatePath("/admin/inbox");
  notifyInboxRealtime(updated.clinicId).catch(() => {});
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
    data: { assignedUserId: userId, status: "OPEN", assignmentSeenAt: assignmentSeenAtFor(userId, userId) },
  });

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(conversation.clinicId).catch(() => {});
  return { success: true };
}

/** "Devolver pra IA" (admin) — ver reactivateAiForConversation em actions/inbox.ts pra
 * detalhe da decisão de não pular o consentimento LGPD. */
export async function reactivateAiForConversationAdmin(conversationId: string) {
  await requireAdminSession();

  const conversation = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conversation) {
    return { success: false, message: "Conversa não encontrada." };
  }

  const aiConfig = await getAiAttendantConfig(conversation.clinicId);
  if (!aiConfig) {
    return { success: false, message: "Esta clínica não tem atendente de IA ativo." };
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { aiEnabled: true },
  });

  await prisma.message.create({
    data: {
      conversationId,
      direction: "OUTBOUND",
      type: "INTERNAL_NOTE",
      content: "🤖 Atendimento devolvido pra IA.",
      status: "SENT",
    },
  });

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(conversation.clinicId).catch(() => {});
  return { success: true };
}

export async function transferConversationAdmin(conversationId: string, targetUserId: string) {
  const { userId } = await requireAdminSession();

  // Mesma regra do lado clínica (ver transferConversation em actions/inbox.ts): a conta
  // genérica "Equipe {nome da clínica}" representa a fila geral, não um atendente de verdade.
  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { name: true, clinic: { select: { tradeName: true } } },
  });
  const isTeamQueue = targetUser ? isTeamQueueUser(targetUser) : false;

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      assignedUserId: isTeamQueue ? null : targetUserId,
      status: "OPEN",
      assignmentSeenAt: isTeamQueue ? null : assignmentSeenAtFor(targetUserId, userId),
    },
    select: { clinicId: true },
  });

  revalidatePath("/admin/inbox");
  notifyInboxRealtime(updated.clinicId).catch(() => {});
  return { success: true };
}

/** Conversas atribuídas a mim (transferência de outro atendente, ou atribuição
 * manual feita por outro admin) que eu ainda não abri — ver a versão pro lado
 * clínica em getUnseenAssignmentNotifications (actions/inbox.ts). */
export async function getUnseenAssignmentNotificationsAdmin() {
  const { userId } = await requireAdminSession();
  const conversations = await prisma.conversation.findMany({
    where: { assignedUserId: userId, assignmentSeenAt: null, status: { in: ACTIVE_STATUSES } },
    select: { id: true, contact: { select: { name: true } } },
  });
  return conversations.map((c) => ({ conversationId: c.id, contactName: c.contact.name }));
}

/** Chamado ao abrir a conversa — ver markAssignmentSeen (actions/inbox.ts). */
export async function markAssignmentSeenAdmin(conversationId: string) {
  const { userId } = await requireAdminSession();
  await prisma.conversation.updateMany({
    where: { id: conversationId, assignedUserId: userId, assignmentSeenAt: null },
    data: { assignmentSeenAt: new Date() },
  });
}

/** Meia-noite de hoje no fuso da Bahia (UTC-3, sem horário de verão) — igual ao já
 * usado em bridge-reminders.ts, mas aqui precisa virar um instante real (não só os
 * campos de calendário) pra servir de filtro numa query `createdAt >= since`. */
function startOfTodayInBahia(): Date {
  const BAHIA_OFFSET_MS = 3 * 60 * 60 * 1000;
  const shifted = new Date(Date.now() - BAHIA_OFFSET_MS);
  shifted.setUTCHours(0, 0, 0, 0);
  return new Date(shifted.getTime() + BAHIA_OFFSET_MS);
}

/** Quantas respostas foram mandadas hoje direto pelo celular conectado (fora do
 * painel) — ver o log criado em "outbound_from_device" no webhook do WhatsApp.
 * Sem `clinicId`, soma todas as clínicas e devolve o detalhamento por clínica
 * (visão "Todas as Clínicas" do admin); as que não deram pra identificar a
 * clínica (instância compartilhada, sem vínculo direto) entram em `unidentified`. */
export async function getOutboundFromDeviceStatsAdmin(clinicId?: string) {
  await requireAdminSession();
  const since = startOfTodayInBahia();

  const logs = await prisma.webhookLog.findMany({
    where: { event: "whatsapp.inbound", status: "IGNORED", createdAt: { gte: since } },
    select: { payload: true },
  });

  const relevant = logs
    .map((l) => l.payload as Record<string, unknown> | null)
    .filter((p): p is Record<string, unknown> => Boolean(p) && p?.kind === "outbound_from_device");

  const filtered = clinicId ? relevant.filter((p) => p.clinicId === clinicId) : relevant;

  if (clinicId) {
    return { total: filtered.length, byClinic: [], unidentified: 0 };
  }

  const countByClinicId = new Map<string, number>();
  let unidentified = 0;
  for (const p of filtered) {
    if (typeof p.clinicId === "string") {
      countByClinicId.set(p.clinicId, (countByClinicId.get(p.clinicId) ?? 0) + 1);
    } else {
      unidentified++;
    }
  }

  const clinicIds = Array.from(countByClinicId.keys());
  const clinics = clinicIds.length
    ? await prisma.clinic.findMany({ where: { id: { in: clinicIds } }, select: { id: true, tradeName: true } })
    : [];
  const nameById = new Map(clinics.map((c) => [c.id, c.tradeName]));

  return {
    total: filtered.length,
    byClinic: Array.from(countByClinicId.entries()).map(([id, count]) => ({
      clinicId: id,
      clinicName: nameById.get(id) ?? "Clínica desconhecida",
      count,
    })),
    unidentified,
  };
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

export async function updateContactInfoAdmin(conversationId: string, data: { name: string; cpf?: string; phone?: string }) {
  await requireAdminSession();

  const trimmedName = data.name.trim();
  if (trimmedName.length < 2) {
    return { success: false as const, error: "Informe o nome do paciente." };
  }

  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    select: { contactId: true },
  });
  if (!conversation) {
    return { success: false as const, error: "Conversa não encontrada" };
  }

  let fullPhone: string | undefined;
  if (data.phone !== undefined) {
    fullPhone = formatToWhatsAppNumber(data.phone);
    if (!isValidWhatsAppNumber(fullPhone)) {
      return { success: false as const, error: "Telefone inválido. Informe com DDD e 9 dígitos (ex: 77999998888)." };
    }
  }

  try {
    await prisma.contact.update({
      where: { id: conversation.contactId },
      data: { name: trimmedName, cpf: data.cpf?.trim() || null, ...(fullPhone ? { phone: fullPhone } : {}) },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { success: false as const, error: "Esse telefone já está cadastrado em outro contato." };
    }
    throw error;
  }
  revalidatePath("/admin/inbox");
  return { success: true as const };
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

  // Fire-and-forget — ver nota em resolveConversation (actions/inbox.ts).
  analyzeConversationQuality(conversationId).catch(() => {});
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

/** Espelho de togglePinConversation/muteConversation/archiveConversation
 * (inbox.ts) pro escopo admin. */
export async function togglePinConversationAdmin(conversationId: string, pinned: boolean) {
  await requireAdminSession();
  await prisma.conversation.update({ where: { id: conversationId }, data: { pinned } });
  revalidatePath("/admin/inbox");
}

export async function muteConversationAdmin(conversationId: string, until: Date | null) {
  await requireAdminSession();
  await prisma.conversation.update({ where: { id: conversationId }, data: { mutedUntil: until } });
  revalidatePath("/admin/inbox");
}

export async function archiveConversationAdmin(conversationId: string, archived: boolean) {
  await requireAdminSession();
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { archivedAt: archived ? new Date() : null },
  });
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

  if (await hasHospitalBridgeIntegration(clinicId)) {
    const bridgeProcedures = await fetchBridgeProcedures(clinicId, convenioId ? Number(convenioId) : undefined);
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
  if (!(await hasHospitalBridgeIntegration(clinicId))) return [];
  return fetchBridgeDoctors(clinicId);
}

export async function listClinicConveniosForAppointmentAdmin(clinicId: string) {
  await requireAdminSession();
  if (!(await hasHospitalBridgeIntegration(clinicId))) return [];
  return fetchBridgeConvenios(clinicId);
}

export async function getClinicDoctorAgendaAdmin(clinicId: string, medicoId: number, date: string) {
  await requireAdminSession();
  if (!(await hasHospitalBridgeIntegration(clinicId))) return [];
  return fetchBridgeAgenda(clinicId, medicoId, date);
}

export async function listClinicPatientsForAppointmentAdmin(clinicId: string, query: string) {
  await requireAdminSession();
  if (!(await hasHospitalBridgeIntegration(clinicId))) return [];
  return fetchBridgePatients(clinicId, query);
}

/** Espelho de suggestIaReply (src/actions/inbox.ts) pro escopo admin — mesma
 * troca do stub de palavra-chave pelo Copilot real. */
export async function suggestIaReplyAdmin(conversationId: string, quotedMessageContent?: string): Promise<string> {
  const suggestions = await getReplySuggestionsAdmin(conversationId, quotedMessageContent);
  return suggestions[0] || "";
}
