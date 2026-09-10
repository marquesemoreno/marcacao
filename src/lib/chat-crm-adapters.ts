import type {
  Contact as PrismaContact,
  Conversation,
  ConversationChannel,
  ConversationDepartment,
  ConversationFunnelStage,
  Message as PrismaMessage,
  MessageType,
  User,
} from "@prisma/client";
import { formatCurrency } from "@/lib/format";
import { isMediaDownloadFailedNotice, isAutoSystemMessage } from "@/lib/chat-messages";
import { canEditMessage } from "@/lib/message-edit";
import type {
  Channel,
  Contact,
  Department,
  FunnelStage,
  Message,
} from "@/types/chat-crm";

const departmentFromDb: Record<ConversationDepartment, Department> = {
  RECEPCAO: "recepcao",
  AGENDAMENTO: "agendamento",
  FINANCEIRO: "financeiro",
};
export const departmentToDb: Record<Department, ConversationDepartment> = {
  recepcao: "RECEPCAO",
  agendamento: "AGENDAMENTO",
  financeiro: "FINANCEIRO",
};

const channelFromDb: Record<ConversationChannel, Channel> = {
  WHATSAPP: "whatsapp",
  INSTAGRAM: "instagram",
  WEBCHAT: "webchat",
};

const funnelStageFromDb: Record<ConversationFunnelStage, FunnelStage> = {
  NOVOS: "novos",
  TRIAGEM: "triagem",
  ORCAMENTO: "orcamento",
  AGENDADO: "agendado",
};
export const funnelStageToDb: Record<FunnelStage, ConversationFunnelStage> = {
  novos: "NOVOS",
  triagem: "TRIAGEM",
  orcamento: "ORCAMENTO",
  agendado: "AGENDADO",
};

const funnelStageLabels: Record<FunnelStage, string> = {
  novos: "Novo",
  triagem: "Em Atendimento",
  orcamento: "Orçamento Enviado",
  agendado: "Agendado",
};

const funnelStageBadgeVariant: Record<FunnelStage, Contact["statusTag"]["variant"]> = {
  novos: "amber",
  triagem: "emerald",
  orcamento: "blue",
  agendado: "purple",
};

// Roda no servidor (Vercel usa UTC) — sem fixar o fuso, "hoje"/"ontem" e o horário
// exibido ficavam sempre 3h à frente do horário real do Brasil.
const BR_TIMEZONE = "America/Sao_Paulo";

function toBRDateKey(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: BR_TIMEZONE });
}

function formatMessageTimestamp(date: Date) {
  const now = new Date();
  const isSameDay = toBRDateKey(date) === toBRDateKey(now);
  if (isSameDay) {
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: BR_TIMEZONE });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (toBRDateKey(date) === toBRDateKey(yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: BR_TIMEZONE });
}

type ConversationWithRelations = Conversation & {
  contact: PrismaContact;
  assignedUser: Pick<User, "id" | "name"> | null;
  messages: PrismaMessage[];
  unreadCount?: number;
  clinic?: { id: string; tradeName: string };
};

/** Quando `viewerUserId` for informado (só faz sentido pra atendente logado, cada um
 * vê seu próprio selo — no admin, que mistura várias clínicas/atendentes na mesma
 * lista, não passa esse parâmetro) computa se ESSA conversa é uma atribuição que
 * ele ainda não viu (ver assignmentSeenAtFor em conversation-assignment.ts). */
function hasUnseenAssignmentFor(conversation: ConversationWithRelations, viewerUserId?: string): boolean {
  if (!viewerUserId) return false;
  return conversation.assignedUserId === viewerUserId && conversation.assignmentSeenAt === null;
}

const REASON_SHORT_LABELS: Record<string, string> = {
  AGENDAMENTO_CONCLUIDO: "🎟️ Agendamento",
  DUVIDA_ESCLARECIDA: "💡 Dúvida Esclarecida",
  ORCAMENTO_ENVIADO: "💲 Orçamento Enviado",
  SEM_RESPOSTA: "⏳ Sem Resposta",
  CANCELAMENTO: "❌ Cancelado",
  ENCAMINHADO: "🔄 Encaminhado",
};

/**
 * A "Contact" da UI do chat/CRM representa, na prática, uma Conversation (com
 * o Contact aninhado) — igual ao ConversationListItem do inbox original.
 * O `id` retornado é o conversationId: toda mutação (tag, funil, transferência)
 * opera em cima da conversa, não do contato bruto.
 */
export function toChatContact(conversation: ConversationWithRelations, viewerUserId?: string): Contact {
  // Prévia da lista: pula nota interna se houver mensagem de verdade mais recente
  // no lote buscado (ver `take: 3` na query) — sem isso, finalizar/transferir um
  // atendimento fazia a prévia mostrar "🔒 Nota: ..." em cima do texto real do
  // paciente, escondendo do que a conversa realmente trata.
  const previewMessage =
    conversation.messages.find((m) => m.type !== "INTERNAL_NOTE") ?? conversation.messages[0] ?? null;
  const lastMessage = conversation.messages[0] ?? null;
  const isResolved = conversation.status === "RESOLVED";

  return {
    id: conversation.id,
    name: conversation.contact.name,
    phone: conversation.contact.phone,
    cpf: conversation.contact.cpf ?? "",
    neighborhood: "",
    avatar: conversation.contact.photoUrl ?? "",
    clinicId: conversation.clinic?.id,
    clinicName: conversation.clinic?.tradeName,
    responsibleAgent: conversation.assignedUser?.name ?? "Não Atribuído",
    department: departmentFromDb[conversation.department],
    channel: channelFromDb[conversation.channel],
    unreadCount: conversation.unreadCount ?? 0,
    hasUnseenAssignment: hasUnseenAssignmentFor(conversation, viewerUserId),
    lastMessage: previewMessage
      ? previewMessage.type === "INTERNAL_NOTE"
        ? `🔒 Nota: ${previewMessage.content}`
        : previewMessage.content ||
          (previewMessage.type === "ATTACHMENT"
            ? previewMessage.mimeType?.startsWith("image/")
              ? "📷 Imagem"
              : "📄 Documento"
            : previewMessage.type === "AUDIO"
              ? "🎤 Áudio"
              : previewMessage.content)
      : "Sem mensagens ainda.",
    lastMessageTime: lastMessage ? formatMessageTimestamp(lastMessage.createdAt) : "",
    statusTag: isResolved
      ? { label: conversation.resolutionReason ? (REASON_SHORT_LABELS[conversation.resolutionReason] || conversation.resolutionReason) : "Finalizado", variant: "slate" }
      : { label: funnelStageLabels[funnelStageFromDb[conversation.funnelStage]], variant: funnelStageBadgeVariant[funnelStageFromDb[conversation.funnelStage]] },
    funnelStage: funnelStageFromDb[conversation.funnelStage],
    tags: conversation.tags,
    consultationHistory: [],
    estimatedValue: conversation.estimatedValue ? formatCurrency(conversation.estimatedValue.toString()) : undefined,
  };
}

export function toChatMessage(
  message: PrismaMessage & { senderUser?: Pick<User, "id" | "name"> | null; mediaUrl?: string | null }
): Message {
  const typeMap: Record<MessageType, Message["type"]> = {
    TEXT: "text",
    AUDIO: "audio",
    INTERNAL_NOTE: "internal_note",
    ATTACHMENT: "attachment",
  };

  const sender: Message["sender"] =
    message.type === "INTERNAL_NOTE" ? "system" : message.direction === "INBOUND" ? "contact" : "agent";

  const deliveryStatusMap: Record<PrismaMessage["status"], Message["deliveryStatus"]> = {
    PENDING: "pending",
    SENT: "sent",
    DELIVERED: "delivered",
    READ: "read",
    FAILED: "failed",
  };

  return {
    id: message.id,
    sender,
    senderName: message.senderUser?.name,
    // Mantém o conteúdo original visível (não troca por um placeholder) — só marca
    // `deleted` pra tela aplicar o estilo (vermelho/tachado), avisando que o remetente
    // apagou sem esconder o que a atendente já tinha visto.
    text: message.content,
    deleted: Boolean(message.deletedAt),
    mediaDownloadFailed:
      message.type === "TEXT" && message.direction === "INBOUND" && isMediaDownloadFailedNotice(message.content),
    isSystemNotice:
      message.type === "TEXT" && message.direction === "OUTBOUND" && isAutoSystemMessage(message.content),
    timestamp: formatMessageTimestamp(message.createdAt),
    type: typeMap[message.type],
    audioDuration: message.audioDuration ?? undefined,
    attachmentName: message.attachmentName ?? undefined,
    attachmentSize: message.attachmentSize ?? undefined,
    mediaUrl: message.mediaUrl ?? undefined,
    mimeType: message.mimeType ?? undefined,
    isRead: message.direction === "INBOUND" ? message.readAt !== null : undefined,
    deliveryStatus: message.direction === "OUTBOUND" ? deliveryStatusMap[message.status] : undefined,
    isEdited: Boolean(message.editedAt),
    canEdit: canEditMessage(message).ok,
    transcription: message.transcription ?? undefined,
  };
}
