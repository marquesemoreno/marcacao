import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/whatsapp";
import { getSignedMediaUrl } from "@/lib/whatsapp-media";
import { buildBroadcastMessage } from "@/lib/broadcast-csv";

const BATCH_SIZE = Number(process.env.BROADCAST_BATCH_SIZE) || 3;

function randomDelayMs(): number {
  return 1500 + Math.floor(Math.random() * 1500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Processa um lote pequeno de cada campanha RUNNING — chamado pelo cron a cada minuto
 * (src/app/api/cron/broadcast-dispatch), nunca manda a lista inteira de uma vez: é
 * justamente esse throttling que reduz o risco de o número ser banido por spam. */
export async function dispatchNextBatch(): Promise<{ processed: number }> {
  const campaigns = await prisma.broadcastCampaign.findMany({ where: { status: "RUNNING" } });
  let processed = 0;

  for (const campaign of campaigns) {
    const recipients = await prisma.broadcastRecipient.findMany({
      where: { campaignId: campaign.id, status: "PENDING" },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    for (const recipient of recipients) {
      if (processed > 0) await sleep(randomDelayMs());
      processed++;

      const contact = await prisma.contact.findUnique({ where: { phone: recipient.phone } });
      if (contact?.optedOutOfBroadcastsAt) {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: { status: "SKIPPED_OPT_OUT" },
        });
        continue;
      }

      const variables = recipient.variables as Record<string, string>;
      const text = buildBroadcastMessage(campaign.messageTemplate, variables);

      let result: { success: boolean; skipped: boolean };
      let failureReason = "Falha ao enviar via WhatsApp";

      if (campaign.imagePath) {
        const mediaUrl = await getSignedMediaUrl(campaign.imagePath);
        if (!mediaUrl) {
          result = { success: false, skipped: false };
          failureReason = "Falha ao gerar URL da imagem da campanha";
        } else {
          result = await sendWhatsAppMedia(
            recipient.phone,
            mediaUrl,
            campaign.imageMimeType ?? "image/jpeg",
            "campanha.jpg",
            text,
            "broadcast.sent",
            campaign.clinicId
          );
        }
      } else {
        result = await sendWhatsAppMessage(recipient.phone, text, "broadcast.sent", campaign.clinicId);
      }

      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data:
          result.success || result.skipped
            ? { status: "SENT", sentAt: new Date() }
            : { status: "FAILED", errorMessage: failureReason },
      });
    }

    const remaining = await prisma.broadcastRecipient.count({
      where: { campaignId: campaign.id, status: "PENDING" },
    });
    if (remaining === 0) {
      await prisma.broadcastCampaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
    }
  }

  return { processed };
}
