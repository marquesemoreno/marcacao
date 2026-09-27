import "server-only";
import type { ConversationChannel } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { whatsappService, type QuotedMessageRef } from "@/lib/whatsapp";
import { sendInstagramMessage } from "@/lib/instagram";
import { messagingWindowState } from "@/lib/instagram-webhook";

type DispatchConversation = {
  id: string;
  clinicId: string;
  channel: ConversationChannel;
  contact: { phone: string | null; externalId: string | null };
};

export type DispatchResult = { success: boolean; skipped?: boolean; keyId?: string | null; error?: string };

/** Mensagem de erro já pronta pra toast — lançada antes de gravar a mensagem, pra não
 * deixar balão "falhou" de algo que nunca teria como sair. */
export class ChannelUnavailableError extends Error {}

/** Recursos que só existem no gateway de WhatsApp (mídia, áudio, cartão de contato,
 * reação, edição) — em conversa de Instagram, avisa em vez de tentar. Devolve o telefone
 * já garantido não-nulo. */
export function requireWhatsAppPhone(conversation: { channel: ConversationChannel; contact: { phone: string | null } }): string {
  if (conversation.channel === "INSTAGRAM") {
    throw new ChannelUnavailableError("Este recurso ainda não está disponível em conversas do Instagram.");
  }
  if (!conversation.contact.phone) {
    throw new ChannelUnavailableError("Este contato não tem telefone cadastrado.");
  }
  return conversation.contact.phone;
}

async function instagramWindow(conversationId: string) {
  const lastInbound = await prisma.message.findFirst({
    where: { conversationId, direction: "INBOUND" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return messagingWindowState(lastInbound?.createdAt ?? null);
}

/** Checagem antes de gravar a mensagem (ver sendMessage em inbox.ts/admin-inbox.ts). */
export async function assertCanSendText(conversation: DispatchConversation) {
  if (conversation.channel === "INSTAGRAM") {
    if (!conversation.contact.externalId) throw new ChannelUnavailableError("Contato do Instagram sem identificador.");
    if ((await instagramWindow(conversation.id)) === "CLOSED") {
      throw new ChannelUnavailableError(
        "O Instagram só permite responder até 7 dias depois da última mensagem do lead. Aguarde ele escrever de novo."
      );
    }
    return;
  }
  if (!conversation.contact.phone) throw new ChannelUnavailableError("Este contato não tem telefone cadastrado.");
}

/** Despacha texto pelo gateway do canal da conversa. keyId = id da mensagem no canal
 * (Baileys key.id ou mid do Instagram), gravado em Message.whatsappKeyId pra acks. */
export async function dispatchOutboundText(
  conversation: DispatchConversation,
  text: string,
  event: string,
  quotedRef?: QuotedMessageRef
): Promise<DispatchResult> {
  if (conversation.channel === "INSTAGRAM") {
    const window = await instagramWindow(conversation.id);
    if (window === "CLOSED" || !conversation.contact.externalId) {
      return { success: false, error: "Janela de mensagens do Instagram fechada." };
    }
    const result = await sendInstagramMessage(conversation.clinicId, conversation.contact.externalId, text, {
      humanAgent: window === "HUMAN_AGENT",
      event: event.replace(/^chat\./, "instagram."),
    });
    return result.success ? { success: true, keyId: result.mid } : { success: false, error: result.error };
  }
  if (!conversation.contact.phone) return { success: false, error: "Contato sem telefone." };
  return whatsappService.sendMessage(conversation.contact.phone, text, event, conversation.clinicId, quotedRef);
}
