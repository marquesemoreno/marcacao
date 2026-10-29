"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isClinicManager, requireClinicManager, requireClinicSession } from "@/lib/session";
import { normalizeBroadcastVariants } from "@/lib/broadcast-variants";
import { isValidEmail, normalizeEmail, prepareChannelRecipients, prepareChannelRows, toSmsNumber } from "@/lib/broadcast-channel";
import { technicalDirectorLine } from "@/lib/broadcast-csv";
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
  /** Público pronto (sistema da clínica, marcadores, seleção de pacientes) no lugar do CSV — só SMS. */
  recipients?: { phone: string; variables: Record<string, string> }[];
}) {
  const { clinicId, userId } = await requireClinicSession();

  if (input.channel !== "SMS" && input.channel !== "EMAIL") return fail("Canal inválido.");
  if (missingChannelConfig(input.channel).length > 0) {
    return fail(`${input.channel === "SMS" ? "SMS" : "E-mail"} ainda não foi ativado para a clínica — fale com o suporte.`);
  }
  const name = input.name.trim();
  const template = input.messageTemplate.trim();
  if (!name || !template) return fail("Preencha o nome da campanha e o texto da mensagem.");
  const subject = input.subject.trim();
  if (input.channel === "EMAIL" && !subject) return fail("Escreva o assunto do e-mail.");
  const checked = normalizeBroadcastVariants(template, input.extraVariants);
  if (!checked.ok) return fail(checked.error);

  let prepared: ReturnType<typeof prepareChannelRecipients>;
  try {
    if (input.recipients) {
      if (input.channel !== "SMS") return fail("Para e-mail, use uma lista com a coluna email.");
      if (input.recipients.length > MAX_CONSENTS_PER_CALL) return fail(`No máximo ${MAX_CONSENTS_PER_CALL} destinatários por campanha.`);
      prepared = prepareChannelRows("SMS", input.recipients.map((r) => ({ raw: String(r.phone ?? ""), variables: r.variables ?? {} })));
    } else prepared = prepareChannelRecipients(input.channel, input.csv);
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

// Limite simples por usuário (por instância do servidor) para o botão de teste não virar
// disparo: 5 testes a cada 10 minutos.
const testLog = new Map<string, number[]>();
const TEST_LIMIT = 5;
const TEST_WINDOW_MS = 10 * 60_000;

/** "Enviar teste para mim" de Nova campanha (SMS/e-mail): manda 1 mensagem na hora, a qualquer
 * horário, com dados de exemplo, para o endereço de quem está montando a campanha. */
export async function sendClinicChannelTest(input: {
  channel: "SMS" | "EMAIL";
  to: string;
  subject: string;
  messageTemplate: string;
  variables?: Record<string, string>;
}) {
  const { clinicId, userId } = await requireClinicSession();
  if (input.channel !== "SMS" && input.channel !== "EMAIL") return fail("Canal inválido.");
  if (missingChannelConfig(input.channel).length > 0) {
    return fail(`${input.channel === "SMS" ? "SMS" : "E-mail"} ainda não foi ativado para a clínica — fale com o suporte.`);
  }
  const template = input.messageTemplate.trim();
  if (!template) return fail("Escreva a mensagem antes de testar.");
  if (input.channel === "EMAIL" && !input.subject.trim()) return fail("Escreva o assunto antes de testar.");
  const to = input.channel === "EMAIL" ? (isValidEmail(input.to) ? normalizeEmail(input.to) : null) : toSmsNumber(input.to);
  if (!to) return fail(input.channel === "EMAIL" ? "E-mail inválido." : "Celular inválido — use DDD + número.");

  const now = Date.now();
  const recent = (testLog.get(userId) ?? []).filter((t) => now - t < TEST_WINDOW_MS);
  if (recent.length >= TEST_LIMIT) return fail("Muitos testes seguidos — espere alguns minutos.");
  testLog.set(userId, [...recent, now]);

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { technicalDirectorName: true, technicalDirectorCrm: true } });
  // Import tardio: channel-broadcast é server-only e quebraria os testes desta action.
  const { sendChannelTest } = await import("@/lib/channel-broadcast");
  const result = await sendChannelTest({
    channel: input.channel,
    to,
    subject: input.subject.trim(),
    template,
    variables: input.variables ?? { nome: "Maria", procedimento: "consulta", data: "10/11" },
    technicalDirector: technicalDirectorLine(clinic?.technicalDirectorName ?? null, clinic?.technicalDirectorCrm ?? null),
  });
  if (!result.success) return fail(result.error ?? "O provedor recusou o envio.");
  return { success: true as const, to };
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

/** O que a tela precisa para SMS/e-mail: se o canal está ativo (os nomes das variáveis que
 * faltam ficam no servidor — a clínica não age sobre eles), quantos aceites ativos a clínica
 * tem e se quem está logado é da gestão (só a gestão registra aceites). */
export async function getChannelSetup() {
  const { clinicId, userId } = await requireClinicSession();
  const [smsConsents, emailConsents, isManager, user] = await Promise.all([
    prisma.channelConsent.count({ where: { clinicId, channel: "SMS", revokedAt: null } }),
    prisma.channelConsent.count({ where: { clinicId, channel: "EMAIL", revokedAt: null } }),
    isClinicManager(userId),
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
  ]);
  return {
    isManager,
    myEmail: user?.email ?? "",
    sms: { ready: missingChannelConfig("SMS").length === 0, consents: smsConsents },
    email: { ready: missingChannelConfig("EMAIL").length === 0, consents: emailConsents },
  };
}
