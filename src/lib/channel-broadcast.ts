import "server-only";
import { prisma } from "@/lib/prisma";
import { getBaseUrl } from "@/lib/format";
import { technicalDirectorLine } from "@/lib/broadcast-csv";
import { isWithinMarketingWindow } from "@/lib/broadcast-schedule";
import { pickBroadcastVariant } from "@/lib/broadcast-variants";
import { missingChannelConfig } from "@/lib/channel-config";
import { channelSendDecision, CHANNEL_OPT_OUT_MESSAGE, NO_CHANNEL_CONSENT_MESSAGE } from "@/lib/channel-consent";
import { buildEmailContent, buildSmsContent } from "@/lib/channel-content";
import { sendSmsViaComtele } from "@/lib/comtele";
import { sendEmailViaResend } from "@/lib/resend";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";

/** Despacho das campanhas de SMS e e-mail, chamado pelo mesmo cron a cada minuto
 * (src/app/api/cron/broadcast-dispatch). Diferente do WhatsApp, aqui NÃO há intervalo de 4–6
 * minutos nem limite diário — esses existem por risco de bloqueio do número, que SMS e
 * e-mail não têm. Continua valendo a janela de marketing (seg–sex 09–17h), o responsável
 * técnico (CFM) e, principalmente, o consentimento POR CANAL (LGPD): só envia a quem tem
 * ChannelConsent ativo, e todo envio leva link para sair. */
const DEFAULT_BATCH_SIZE = 10;

type Env = Record<string, string | undefined>;

function batchSize(env: Env): number {
  const n = Number(env.CHANNEL_BATCH_SIZE);
  return Number.isInteger(n) && n >= 1 ? n : DEFAULT_BATCH_SIZE;
}

/** "Enviar teste para mim": 1 mensagem, na hora, para quem está montando a campanha. Não
 * passa pela janela de marketing nem pelo aceite (é a própria equipe), mas leva o mesmo
 * rodapé (RT + link de sair, aqui um link de exemplo) para conferir como o paciente recebe. */
export async function sendChannelTest(input: {
  channel: "SMS" | "EMAIL";
  to: string;
  subject: string;
  template: string;
  variables: Record<string, string>;
  technicalDirector: string | null;
  env?: Env;
}): Promise<{ success: boolean; error?: string }> {
  const env = input.env ?? process.env;
  const unsubscribeUrl = `${getBaseUrl()}/api/u/teste`;
  if (input.channel === "EMAIL") {
    const content = buildEmailContent({
      subject: `[TESTE] ${input.subject}`,
      template: input.template,
      variables: input.variables,
      technicalDirector: input.technicalDirector,
      unsubscribeUrl,
    });
    return sendEmailViaResend({
      apiKey: env.RESEND_API_KEY ?? "",
      from: env.BROADCAST_EMAIL_FROM ?? "",
      to: input.to,
      subject: content.subject,
      html: content.html,
      text: content.text,
    });
  }
  const content = buildSmsContent({ template: input.template, variables: input.variables, technicalDirector: input.technicalDirector, unsubscribeUrl });
  return sendSmsViaComtele({
    apiKey: env.COMTELE_API_KEY ?? "",
    route: Number(env.COMTELE_ROUTE),
    number: input.to,
    message: content.text,
    tag: "teste",
  });
}

export async function dispatchNextChannelBatch(options: { now?: Date; env?: Env } = {}): Promise<{ processed: number }> {
  const now = options.now ?? new Date();
  const env = options.env ?? process.env;
  if (!isWithinMarketingWindow(now)) return { processed: 0 };

  const campaigns = await prisma.broadcastCampaign.findMany({
    where: { status: "RUNNING", channel: { in: ["SMS", "EMAIL"] } },
    include: { clinic: { select: { technicalDirectorName: true, technicalDirectorCrm: true } } },
  });

  let processed = 0;
  for (const campaign of campaigns) {
    // Sem provedor configurado a campanha espera (destinatários continuam PENDING), em vez
    // de falhar todo mundo de uma vez.
    if (missingChannelConfig(campaign.channel, env).length > 0) continue;

    const recipients = await prisma.broadcastRecipient.findMany({
      where: { campaignId: campaign.id, status: "PENDING" },
      take: batchSize(env),
      orderBy: { createdAt: "asc" },
    });
    const technicalDirector = technicalDirectorLine(campaign.clinic.technicalDirectorName, campaign.clinic.technicalDirectorCrm);

    for (const recipient of recipients) {
      processed++;
      const consent = await prisma.channelConsent.findUnique({
        where: { clinicId_channel_address: { clinicId: campaign.clinicId, channel: campaign.channel, address: recipient.phone } },
        select: { id: true, consentAt: true, revokedAt: true },
      });
      const decision = channelSendDecision({ consentAt: consent?.consentAt ?? null, revokedAt: consent?.revokedAt ?? null });
      if (decision !== "ENVIAR" || !consent) {
        await prisma.broadcastRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SKIPPED_OPT_OUT",
            errorMessage: decision === "SAIU" ? CHANNEL_OPT_OUT_MESSAGE : NO_CHANNEL_CONSENT_MESSAGE,
          },
        });
        continue;
      }

      const variables = recipient.variables as Record<string, string>;
      const variant = pickBroadcastVariant([campaign.messageTemplate, ...campaign.messageVariants], recipient.id);
      const unsubscribeUrl = `${getBaseUrl()}/api/u/${signUnsubscribeToken(consent.id, env.UNSUBSCRIBE_SECRET ?? "")}`;

      let result: { success: boolean; error?: string; id?: string };
      if (campaign.channel === "EMAIL") {
        const content = buildEmailContent({
          subject: campaign.subject ?? "",
          template: variant.text,
          variables,
          technicalDirector,
          unsubscribeUrl,
        });
        result = await sendEmailViaResend({
          apiKey: env.RESEND_API_KEY ?? "",
          from: env.BROADCAST_EMAIL_FROM ?? "",
          to: recipient.phone,
          subject: content.subject,
          html: content.html,
          text: content.text,
          headers: content.headers,
          idempotencyKey: recipient.id,
        });
      } else {
        const content = buildSmsContent({ template: variant.text, variables, technicalDirector, unsubscribeUrl });
        result = await sendSmsViaComtele({
          apiKey: env.COMTELE_API_KEY ?? "",
          route: Number(env.COMTELE_ROUTE),
          number: recipient.phone,
          message: content.text,
          tag: `campanha-${campaign.id}`,
        });
      }

      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: result.success
          ? { status: "SENT", sentAt: new Date(), variantIndex: variant.index, providerMessageId: result.id ?? null }
          : { status: "FAILED", errorMessage: result.error ?? "Falha ao enviar" },
      });
    }

    const remaining = await prisma.broadcastRecipient.count({ where: { campaignId: campaign.id, status: "PENDING" } });
    if (remaining === 0) {
      await prisma.broadcastCampaign.update({ where: { id: campaign.id }, data: { status: "COMPLETED" } });
    }
  }

  return { processed };
}
