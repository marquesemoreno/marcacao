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
export function toChatContact(conversation: ConversationWithRelations): Contact {
  const lastMessage = conversation.messages[0] ?? null;
  const isResolved = conversation.status === "RESOLVED";

  return {
    id: conversation.id,
    name: conversation.contact.name,
    phone: conversation.contact.phone,
    cpf: conversation.contact.cpf ?? "",
    neighborhood: "",
    avatar: "",
    clinicId: conversation.clinic?.id,
    clinicName: conversation.clinic?.tradeName,
    responsibleAgent: conversation.assignedUser?.name ?? "Não Atribuído",
    department: departmentFromDb[conversation.department],
    channel: channelFromDb[conversation.channel],
    unreadCount: conversation.unreadCount ?? 0,
    lastMessage: lastMessage
      ? lastMessage.type === "INTERNAL_NOTE"
        ? `🔒 Nota: ${lastMessage.content}`
        : lastMessage.content ||
          (lastMessage.type === "ATTACHMENT"
            ? lastMessage.mimeType?.startsWith("image/")
              ? "📷 Imagem"
              : "📄 Documento"
            : lastMessage.type === "AUDIO"
              ? "🎤 Áudio"
              : lastMessage.content)
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
    text: message.content,
    timestamp: formatMessageTimestamp(message.createdAt),
    type: typeMap[message.type],
    audioDuration: message.audioDuration ?? undefined,
    attachmentName: message.attachmentName ?? undefined,
    attachmentSize: message.attachmentSize ?? undefined,
    mediaUrl: message.mediaUrl ?? undefined,
    mimeType: message.mimeType ?? undefined,
    isRead: message.direction === "INBOUND" ? message.readAt !== null : undefined,
    deliveryStatus: message.direction === "OUTBOUND" ? deliveryStatusMap[message.status] : undefined,
  };
}
