"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { normalizeBroadcastVariants } from "@/lib/broadcast-variants";
import { prepareChannelRecipients } from "@/lib/broadcast-channel";
import { missingChannelConfig } from "@/lib/channel-config";
import { channelSendDecision, parseConsentList, planConsentChanges } from "@/lib/channel-consent";

/** Disparos por SMS e e-mail da clínica. O WhatsApp continua em clinic-broadcast.ts; aqui
 * ficam a criação da campanha por canal e o registro dos aceites (ChannelConsent). O envio é
 * feito pelo cron (src/lib/channel-broadcast.ts). */
const MAX_CONSENTS_PER_CALL = 5000;

type ChannelError = { success: false; error: string };
const fail = (error: string): ChannelError => ({ success: false, error });

export async function createClinicChannelCampaign(input: {
  channel: "SMS" | "EMAIL";
  name: string;
  /** Só e-mail; ignorado no SMS. */
  subject: string;
  messageTemplate: string;
  extraVariants: string[];
  csv: string;
}) {
  const { clinicId, userId } = await requireClinicSession();

  if (input.channel !== "SMS" && input.channel !== "EMAIL") return fail("Canal inválido.");
  const name = input.name.trim();
  const template = input.messageTemplate.trim();
  if (!name || !template) return fail("Preencha o nome da campanha e o texto da mensagem.");
  const subject = input.subject.trim();
  if (input.channel === "EMAIL" && !subject) return fail("Escreva o assunto do e-mail.");
  const checked = normalizeBroadcastVariants(template, input.extraVariants);
  if (!checked.ok) return fail(checked.error);

  let prepared: ReturnType<typeof prepareChannelRecipients>;
  try {
    prepared = prepareChannelRecipients(input.channel, input.csv);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Não foi possível ler o CSV.");
  }
  if (prepared.recipients.length === 0) {
    return fail("Nenhum destinatário válido na lista — confira o CSV.");
  }

  // Só informativo: quem não tiver consentimento ativo na hora do envio é pulado (e marcado).
  const consents = await prisma.channelConsent.findMany({
    where: { clinicId, channel: input.channel, address: { in: prepared.recipients.map((r) => r.address) } },
    select: { address: true, consentAt: true, revokedAt: true },
  });
  const withConsent = consents.filter((c) => channelSendDecision({ consentAt: c.consentAt, revokedAt: c.revokedAt }) === "ENVIAR").length;

  const campaign = await prisma.broadcastCampaign.create({
    data: {
      clinicId,
      name,
      channel: input.channel,
      subject: input.channel === "EMAIL" ? subject : null,
      messageTemplate: checked.variants[0],
      messageVariants: checked.variants.slice(1),
      createdByUserId: userId,
      recipients: {
        create: prepared.recipients.map((r) => ({ phone: r.address, variables: r.variables, status: "PENDING" as const })),
      },
    },
  });

  revalidatePath("/clinic/disparos");
  return {
    success: true as const,
    campaignId: campaign.id,
    total: prepared.recipients.length,
    invalid: prepared.invalid,
    duplicates: prepared.duplicates,
    withConsent,
  };
}

/** Registra aceites de marketing por SMS/e-mail (só gestão). `source` é obrigatório: é de onde
 * veio o consentimento (ficha, formulário…), a prova em caso de questionamento (LGPD). */
export async function registerChannelConsents(channel: "SMS" | "EMAIL", raw: string, source: string) {
  const { clinicId } = await requireClinicManager();

  const trimmedSource = source.trim();
  if (!trimmedSource) return fail("Informe de onde veio o aceite (ex.: ficha de papel 10/2026).");
  const { addresses, invalid } = parseConsentList(channel, raw);
  if (addresses.length === 0) return fail("Nenhum endereço válido na lista.");
  if (addresses.length > MAX_CONSENTS_PER_CALL) return fail(`Envie no máximo ${MAX_CONSENTS_PER_CALL} endereços por vez.`);

  const existing = await prisma.channelConsent.findMany({
    where: { clinicId, channel, address: { in: addresses } },
    select: { address: true, consentAt: true, revokedAt: true },
  });
  const plan = planConsentChanges(new Map(existing.map((c) => [c.address, { consentAt: c.consentAt, revokedAt: c.revokedAt }])), addresses);

  const now = new Date();
  if (plan.create.length > 0) {
    await prisma.channelConsent.createMany({
      data: plan.create.map((address) => ({ clinicId, channel, address, consentAt: now, source: trimmedSource })),
    });
  }
  if (plan.renew.length > 0) {
    await prisma.channelConsent.updateMany({
      where: { clinicId, channel, address: { in: plan.renew } },
      data: { consentAt: now, source: trimmedSource },
    });
  }

  revalidatePath("/clinic/disparos");
  return {
    success: true as const,
    created: plan.create.length,
    renewed: plan.renew.length,
    already: plan.already,
    invalid: invalid.slice(0, 10),
    invalidCount: invalid.length,
  };
}

/** O que a tela precisa para SMS/e-mail: o que falta configurar no servidor (nomes das
 * variáveis, nunca valores) e quantos aceites ativos a clínica tem. */
export async function getChannelSetup() {
  const { clinicId } = await requireClinicSession();
  const [smsConsents, emailConsents] = await Promise.all([
    prisma.channelConsent.count({ where: { clinicId, channel: "SMS", revokedAt: null } }),
    prisma.channelConsent.count({ where: { clinicId, channel: "EMAIL", revokedAt: null } }),
  ]);
  return {
    sms: { missing: missingChannelConfig("SMS"), consents: smsConsents },
    email: { missing: missingChannelConfig("EMAIL"), consents: emailConsents },
  };
}
