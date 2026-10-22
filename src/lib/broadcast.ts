import { marketingSendDecision, NO_CONSENT_MESSAGE } from "@/lib/marketing-consent";
import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, sendWhatsAppMedia, toggleNinthDigit } from "@/lib/whatsapp";
import { getSignedMediaUrl } from "@/lib/whatsapp-media";
import { technicalDirectorLine, buildBroadcastMessage } from "@/lib/broadcast-csv";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { lastAutomatedSend } from "@/lib/automated-pacing-server";
import { isWithinReminderWindow, lowPriorityMustYield } from "@/lib/automated-pacing";
import { isMarketingGapElapsed, isWithinMarketingWindow, MARKETING_DAILY_CAP, startOfBrazilDay } from "@/lib/broadcast-schedule";


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
  const campaigns = await prisma.broadcastCampaign.findMany({
    where: { status: "RUNNING" },
    include: { clinic: { select: { technicalDirectorName: true, technicalDirectorCrm: true } } },
  });
  let processed = 0;

  const now = new Date();
  for (const campaign of campaigns) {
    // Marketing (tudo que não é aviso de remarcação, com ou sem tag de acompanhamento): só
    // seg–sex 09–17h, 1 por vez com 4–6 min sorteados desde a última enviada e no máximo
    // MARKETING_DAILY_CAP por dia.
    const isMarketing = campaign.tagOnSend !== RESCHEDULE_PENDING_TAG;
    const take = 1;
    if (!isMarketing) {
      // Aviso de remarcação: também 1 a cada 4–6 min, no intervalo único da clínica
      // (decisão do usuário em 15/10/2026, pra evitar bloqueio), mas sem esperar o horário
      // das campanhas — sai das 08h às 18h todo dia, como os lembretes, e sem limite diário.
      if (!isWithinReminderWindow(now)) continue;
      const last = await lastAutomatedSend(campaign.clinicId);
      if (!isMarketingGapElapsed(last.at, now, Math.random())) continue;
    } else {
      if (!isWithinMarketingWindow(now)) continue;
      const sentToday = await prisma.broadcastRecipient.count({
        where: { campaignId: campaign.id, status: "SENT", sentAt: { gte: startOfBrazilDay(now) } },
      });
      if (sentToday >= MARKETING_DAILY_CAP) continue;
      // Baixa prioridade cede a vez a outra campanha da clínica com gente na fila. Os
      // lembretes já têm a vez garantida: rodam antes neste mesmo minuto e não alternam
      // com campanha de baixa prioridade (ver marketingCampaignReady).
      if (campaign.lowPriority) {
        const otherCampaignPending = await prisma.broadcastRecipient.count({
          where: {
            status: "PENDING",
            campaign: { clinicId: campaign.clinicId, status: "RUNNING", lowPriority: false, id: { not: campaign.id } },
          },
        });
        if (lowPriorityMustYield({ lowPriority: true, otherCampaignPending: otherCampaignPending > 0, remindersPending: false })) continue;
      }
      // Intervalo único da clínica: conta desde a última mensagem automática de qualquer
      // tipo (lembrete D-1 ou campanha) — nunca saem juntos (ver automated-pacing.ts).
      const last = await lastAutomatedSend(campaign.clinicId);
      if (!isMarketingGapElapsed(last.at, now, Math.random())) continue;
    }
    const recipients = await prisma.broadcastRecipient.findMany({
      where: { campaignId: campaign.id, status: "PENDING" },
      take,
      orderBy: { createdAt: "asc" },
    });

    for (const recipient of recipients) {
      if (processed > 0) await sleep(randomDelayMs());
      processed++;

      const contact = await prisma.contact.findUnique({
        where: { phone: recipient.phone },
        select: {
          id: true,
          optedOutOfBroadcastsAt: true,
          clinicProfiles: { where: { clinicId: campaign.clinicId }, select: { marketingConsentAt: true } },
        },
      });
      const isMarcador = Boolean(
        await prisma.marcador.findFirst({
          // Cadastro de marcadores pode estar com ou sem o 9º dígito (importação de 15/10).
          where: { clinicId: campaign.clinicId, phone: { in: [recipient.phone, toggleNinthDigit(recipient.phone)].filter((p): p is string => !!p) } },
          select: { id: true },
        })
      );
      // Marketing só com consentimento da clínica (LGPD); aviso de remarcação é transacional.
      const decision = marketingSendDecision({
        optedOut: Boolean(contact?.optedOutOfBroadcastsAt),
        consentAt: contact?.clinicProfiles[0]?.marketingConsentAt ?? null,
        isMarcador,
        isTransactional: campaign.tagOnSend === RESCHEDULE_PENDING_TAG,
      });
      if (decision !== "ENVIAR") {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SKIPPED_OPT_OUT",
            errorMessage: decision === "SEM_CONSENTIMENTO" ? NO_CONSENT_MESSAGE : "Pediu para não receber",
          },
        });
        continue;
      }

      const variables = recipient.variables as Record<string, string>;
      const text = buildBroadcastMessage(campaign.messageTemplate, variables, {
        technicalDirector:
          campaign.tagOnSend === RESCHEDULE_PENDING_TAG
            ? null
            : technicalDirectorLine(campaign.clinic.technicalDirectorName, campaign.clinic.technicalDirectorCrm),
      });

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
