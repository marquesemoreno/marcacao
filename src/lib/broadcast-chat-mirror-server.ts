import "server-only";
import { errorSummary } from "@/lib/safe-error";
import { prisma } from "@/lib/prisma";
import { toggleNinthDigit } from "@/lib/whatsapp";
import { CAMPAIGN_MIRROR_WINDOW_DAYS, campaignChatMirror } from "@/lib/broadcast-chat-mirror";

/** Chamado pelo webhook antes de gravar a mensagem do paciente: se ele recebeu uma campanha
 * desta clínica nos últimos 30 dias e ela ainda não está na conversa, grava a mensagem da
 * campanha com a hora do envio. Não mexe em status, dono nem ordem da fila. Nunca lança. */
export async function mirrorCampaignMessageOnReply(input: { conversationId: string; clinicId: string; phone: string }): Promise<void> {
  try {
    const since = new Date(Date.now() - CAMPAIGN_MIRROR_WINDOW_DAYS * 86_400_000);
    const phones = [input.phone, toggleNinthDigit(input.phone)].filter((p): p is string => !!p);
    const recipient = await prisma.broadcastRecipient.findFirst({
      where: { phone: { in: phones }, status: "SENT", sentAt: { gte: since }, campaign: { clinicId: input.clinicId, channel: "WHATSAPP" } },
      orderBy: { sentAt: "desc" },
      select: {
        sentAt: true,
        variables: true,
        variantIndex: true,
        campaign: {
          select: {
            messageTemplate: true,
            messageVariants: true,
            cloudTemplateName: true,
            cloudTemplateBody: true,
            cloudTemplateVariants: true,
            cloudTemplateParams: true,
            tagOnSend: true,
            imagePath: true,
            imageMimeType: true,
            attachmentName: true,
            clinic: { select: { technicalDirectorName: true, technicalDirectorCrm: true } },
          },
        },
      },
    });
    if (!recipient?.sentAt) return;
    const already = await prisma.message.findFirst({
      where: { conversationId: input.conversationId, direction: "OUTBOUND", createdAt: recipient.sentAt },
      select: { id: true },
    });
    if (already) return;

    const { clinic, ...campaign } = recipient.campaign;
    const mirror = campaignChatMirror(
      { ...campaign, technicalDirectorName: clinic.technicalDirectorName, technicalDirectorCrm: clinic.technicalDirectorCrm },
      { variables: (recipient.variables ?? {}) as Record<string, string>, variantIndex: recipient.variantIndex },
    );
    await prisma.message.create({
      data: {
        conversationId: input.conversationId,
        direction: "OUTBOUND",
        content: mirror.content,
        status: "DELIVERED",
        createdAt: recipient.sentAt,
        ...(mirror.media ? { type: "ATTACHMENT" as const, ...mirror.media } : { type: "TEXT" as const }),
      },
    });
  } catch (error) {
    console.error("[campanha no Chat] falha:", errorSummary(error));
  }
}
