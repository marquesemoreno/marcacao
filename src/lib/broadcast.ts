import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/whatsapp";
import { getSignedMediaUrl } from "@/lib/whatsapp-media";
import { buildBroadcastMessage } from "@/lib/broadcast-csv";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { lastAutomatedSend } from "@/lib/automated-pacing-server";
import { isMarketingGapElapsed, isWithinMarketingWindow, MARKETING_DAILY_CAP, startOfBrazilDay } from "@/lib/broadcast-schedule";

const BATCH_SIZE = Number(process.env.BROADCAST_BATCH_SIZE) || 3;

function randomDelayMs(): number {
  return 1500 + Math.floor(Math.random() * 1500);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Processa um lote pequeno de cada campanha RUNNING — chamado pelo Vercel Cron a cada minuto
 * (src/app/api/cron/broadcast-dispatch), nunca manda a lista inteira de uma vez: é
 * justamente esse throttling que reduz o risco de o número ser banido por spam. */
export async function dispatchNextBatch(): Promise<{ processed: number }> {
  const campaigns = await prisma.broadcastCampaign.findMany({ where: { status: "RUNNING" } });
  let processed = 0;

  const now = new Date();
  for (const campaign of campaigns) {
    // Marketing (tudo que não é aviso de remarcação, com ou sem tag de acompanhamento): só
    // seg–sex 09–17h, 1 por vez com 4–6 min sorteados desde a última enviada e no máximo
    // MARKETING_DAILY_CAP por dia. Aviso de remarcação é urgente e mantém o ritmo antigo.
    const isMarketing = campaign.tagOnSend !== RESCHEDULE_PENDING_TAG;
    let take = BATCH_SIZE;
    if (isMarketing) {
      if (!isWithinMarketingWindow(now)) continue;
      const sentToday = await prisma.broadcastRecipient.count({
        where: { campaignId: campaign.id, status: "SENT", sentAt: { gte: startOfBrazilDay(now) } },
      });
      if (sentToday >= MARKETING_DAILY_CAP) continue;
      // Intervalo único da clínica: conta desde a última mensagem automática de qualquer
      // tipo (lembrete D-1 ou campanha) — nunca saem juntos (ver automated-pacing.ts).
      const last = await lastAutomatedSend(campaign.clinicId);
      if (!isMarketingGapElapsed(last.at, now, Math.random())) continue;
      take = 1;
    }
    const recipients = await prisma.broadcastRecipient.findMany({
      where: { campaignId: campaign.id, status: "PENDING" },
      take,
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

      // Aviso de remarcação em massa (e qualquer futura campanha que precise disso):
      // marca a conversa do destinatário e reabre ela pra voltar a aparecer na fila
      // (ver RESCHEDULE_PENDING_TAG em conversation-tags.ts e computeQueueState).
      if (result.success && campaign.tagOnSend && contact) {
        const conversation = await prisma.conversation.findFirst({
          where: { clinicId: campaign.clinicId, contactId: contact.id },
        });
        if (conversation) {
          await prisma.conversation.update({
            where: { id: conversation.id },
            data: {
              // Campanha de marketing só marca a conversa (pra acompanhar quem recebeu);
              // não reabre nem joga pro topo da fila — isso é só do aviso de remarcação.
              ...(isMarketing ? {} : { status: "OPEN" as const, lastMessageAt: new Date() }),
              ...(conversation.tags.includes(campaign.tagOnSend) ? {} : { tags: { push: campaign.tagOnSend } }),
            },
          });
        }
      }
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
