"use server";

import { normalizeBroadcastVariants, previewBroadcastVariants, countSentByVariant } from "@/lib/broadcast-variants";

import { NO_CONSENT_MESSAGE } from "@/lib/marketing-consent";
import { buildTemplateParams, checkTemplateParamSources, renderTemplatePreview } from "@/lib/broadcast-cloud-template";
import { listCloudTemplates } from "@/lib/whatsapp-cloud";
import { decryptToken } from "@/lib/token-crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { technicalDirectorLine, buildBroadcastMessage, type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { campaignSituation, estimateCampaignFinish, patientsNeedingCall, startOfBrazilDay, unfilledPlaceholders, unknownTemplateVariables, urgentSendTimes } from "@/lib/broadcast-schedule";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { formatDate, getBaseUrl } from "@/lib/format";
import { fetchBridgeCampaignPatients } from "@/lib/hospital-bridge";
import { lastAutomatedSend } from "@/lib/automated-pacing-server";
import { buildCampaignAudience } from "@/lib/campaign-audience";
import { missingChannelConfig } from "@/lib/channel-config";
import { channelSendDecision } from "@/lib/channel-consent";
import { buildEmailContent, buildSmsContent } from "@/lib/channel-content";

import { attachmentKindOf, checkBroadcastAttachment } from "@/lib/broadcast-attachment";

/** Mirror de listBroadcastCampaigns (admin-broadcast.ts) — clinicId vem da sessão,
 * não é parâmetro (a clínica só pode ver as próprias campanhas). */
export async function listClinicBroadcastCampaigns() {
  const { clinicId } = await requireClinicSession();
  const now = new Date();
  const dayStart = startOfBrazilDay(now);
  const [campaigns, remindersOn] = await Promise.all([
    prisma.broadcastCampaign.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { recipients: true } },
      recipients: {
        select: { id: true, status: true, sentAt: true, errorMessage: true, phone: true, variables: true, calledAt: true, variantIndex: true, deliveryStatus: true },
        orderBy: { createdAt: "asc" },
      },
    },
    }),
    clinicRemindersActive(clinicId, now),
  ]);
  // Alguma campanha normal com gente na fila? (a de baixa prioridade cede a vez — ver
  // lowPriorityMustYield em automated-pacing.ts)
  const isActiveMarketing = (c: (typeof campaigns)[number]) =>
    c.status === "RUNNING" && c.tagOnSend !== RESCHEDULE_PENDING_TAG && c.recipients.some((r) => r.status === "PENDING");
  const highPriorityActive = campaigns.filter((c) => isActiveMarketing(c) && !c.lowPriority).length;
  const highPriorityPending = highPriorityActive > 0;

  return campaigns.map((c) => {
    const sent = c.recipients.filter((r) => r.status === "SENT").length;
    const failedList = c.recipients.filter((r) => r.status === "FAILED");
    const noConsent = c.recipients.filter((r) => r.status === "SKIPPED_OPT_OUT" && r.errorMessage === NO_CONSENT_MESSAGE).length;
    const skipped = c.recipients.filter((r) => r.status === "SKIPPED_OPT_OUT").length - noConsent;
    const pending = c.recipients.filter((r) => r.status === "PENDING").length;
    const sentToday = c.recipients.filter((r) => r.status === "SENT" && r.sentAt && r.sentAt >= dayStart).length;
    const yielding = c.lowPriority && highPriorityPending;
    const isReschedule = c.tagOnSend === RESCHEDULE_PENDING_TAG;
    // SMS e e-mail não seguem o ritmo de 4–6 min do WhatsApp: sem previsão baseada nele.
    const isWhatsapp = c.channel === "WHATSAPP";
    // Campanhas normais ativas se revezam no mesmo ritmo da clínica (ver automated-pacing).
    const sharing = c.lowPriority ? 1 : Math.max(1, highPriorityActive);
    const estimate = isReschedule || !isWhatsapp ? { businessDays: 0, finishIso: null } : estimateCampaignFinish({ pending, sentToday, now, sharing });
    // Com lembretes de confirmação ativos, nas manhãs eles têm a vez — o fim real pode
    // cair mais tarde: a tela mostra uma faixa ("entre X e Y") em vez de uma data só.
    const late = !isReschedule && isWhatsapp && remindersOn && !c.lowPriority
      ? estimateCampaignFinish({ pending, sentToday, now, sharing: sharing + 1 })
      : null;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      hasImage: Boolean(c.imagePath),
      /** "image" | "document" | null (sem anexo) e o nome do arquivo que o paciente vê. */
      attachmentKind: c.imagePath ? attachmentKindOf(c.imageMimeType) : null,
      attachmentName: c.attachmentName,
      lowPriority: c.lowPriority,
      total: c._count.recipients,
      sent,
      failed: failedList.length,
      failureReasons: [...new Set(failedList.map((r) => r.errorMessage).filter((m): m is string => !!m))].slice(0, 3),
      failures: failedList.slice(0, 30).map((r) => ({ phone: r.phone, reason: r.errorMessage })),
      skipped,
      noConsent,
      /** E-mail: retorno do Resend (webhook). null = canal sem relatório de entrega. */
      delivery:
        c.channel === "EMAIL"
          ? {
              delivered: c.recipients.filter((r) => r.deliveryStatus === "DELIVERED").length,
              bounced: c.recipients.filter((r) => r.deliveryStatus === "BOUNCED").length,
              complained: c.recipients.filter((r) => r.deliveryStatus === "COMPLAINED").length,
            }
          : null,
      // Quantos receberam cada texto — só faz sentido com variações.
      sentByVariant: c.messageVariants.length ? countSentByVariant(c.recipients, 1 + c.messageVariants.length) : null,
      pending,
      channel: c.channel,
      situation: isReschedule && c.status === "RUNNING" && pending > 0
        ? { tone: "ok" as const, text: "Enviando aviso de remarcação — 1 a cada 4–6 min, das 8h às 18h" }
        : !isWhatsapp && c.status === "RUNNING" && pending > 0
          ? { tone: "ok" as const, text: `Enviando por ${c.channel === "SMS" ? "SMS" : "e-mail"} em lotes, de segunda a sexta das 9h às 17h` }
          : campaignSituation({ status: c.status, pending, sentToday, yielding, now, sharing }),
      isReschedule,
      urgentLastAt: isReschedule && pending > 0 ? urgentSendTimes(pending, now).at(-1)?.toISOString() ?? null : null,
      needsCall: isReschedule ? buildCallList(c.recipients, now) : [],
      finishIso: c.status === "COMPLETED" ? null : estimate.finishIso,
      finishLateIso: c.status === "COMPLETED" || !late || late.finishIso === estimate.finishIso ? null : late.finishIso,
      businessDays: estimate.businessDays,
      createdAt: c.createdAt,
    };
  });
}

type RecipientRow = { id: string; status: string; sentAt: Date | null; phone: string; variables: unknown; calledAt: Date | null };

/** Lista "Precisam de ligação" do aviso urgente (ver patientsNeedingCall). */
function buildCallList(recipients: RecipientRow[], now: Date) {
  const vars = (r: RecipientRow) => (r.variables ?? {}) as Record<string, string>;
  const flagged = patientsNeedingCall(
    recipients.map((r) => ({ id: r.id, status: r.status, sentAt: r.sentAt, dataIso: vars(r).dataIso ?? "", horario: vars(r).horario ?? "" })),
    now
  );
  return flagged.map((f) => {
    const r = recipients.find((x) => x.id === f.id)!;
    return {
      id: r.id,
      name: vars(r).nome ?? "",
      phone: r.phone,
      horario: vars(r).horario || null,
      reason: f.reason,
      called: !!r.calledAt,
    };
  });
}

/** A clínica tem lembretes de confirmação rodando (ponte ativa e sem pausa)? Eles dividem
 * o intervalo de 4–6 min com as campanhas. */
async function clinicRemindersActive(clinicId: string, now: Date): Promise<boolean> {
  const h = await prisma.hospitalIntegration.findUnique({ where: { clinicId }, select: { active: true, remindersPausedUntil: true } });
  return !!h?.active && (!h.remindersPausedUntil || h.remindersPausedUntil < now);
}

/** Quando deve sair a próxima mensagem automática da clínica (lembrete, campanha ou aviso),
 * pelo intervalo único de 4–6 min — explica na tela por que uma campanha "demora". */
export async function getClinicNextAutomatedSend(): Promise<{ lastAt: string | null; nextAt: string | null }> {
  const { clinicId } = await requireClinicSession();
  const last = await lastAutomatedSend(clinicId);
  if (!last.at) return { lastAt: null, nextAt: null };
  return { lastAt: last.at.toISOString(), nextAt: new Date(last.at.getTime() + 5 * 60_000).toISOString() };
}

/** Prévia antes de iniciar: quantos vão receber, a mensagem como o 1º destinatário
 * recebe (variáveis preenchidas + rodapé de saída) e a previsão de término. */
export async function getClinicCampaignStartPreview(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  const campaign = await prisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
    select: { messageTemplate: true, messageVariants: true, imagePath: true, imageMimeType: true, attachmentName: true, lowPriority: true, tagOnSend: true, channel: true, subject: true, cloudTemplateName: true, cloudTemplateBody: true, cloudTemplateParams: true, clinic: { select: { technicalDirectorName: true, technicalDirectorCrm: true } } },
  });
  const isReschedule = campaign?.tagOnSend === RESCHEDULE_PENDING_TAG;
  const rt = isReschedule ? null : technicalDirectorLine(campaign?.clinic.technicalDirectorName, campaign?.clinic.technicalDirectorCrm);
  const otherActive = await prisma.broadcastCampaign.count({
    where: {
      clinicId,
      channel: "WHATSAPP",
      status: "RUNNING",
      lowPriority: false,
      id: { not: campaignId },
      OR: [{ tagOnSend: null }, { tagOnSend: { not: RESCHEDULE_PENDING_TAG } }],
      recipients: { some: { status: "PENDING" } },
    },
  });
  const [pending, first, sentToday] = await Promise.all([
    prisma.broadcastRecipient.count({ where: { campaignId, status: "PENDING" } }),
    prisma.broadcastRecipient.findFirst({ where: { campaignId, status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { phone: true, variables: true } }),
    prisma.broadcastRecipient.count({ where: { campaignId, status: "SENT", sentAt: { gte: startOfBrazilDay(new Date()) } } }),
  ]);
  const vars = (first?.variables ?? {}) as Record<string, string>;
  const previews = campaign ? previewBroadcastVariants([campaign.messageTemplate, ...campaign.messageVariants], vars, { technicalDirector: rt }) : [];

  // SMS e e-mail: mensagem como sairá (com link de sair e RT), créditos de SMS e quantos dos
  // pendentes têm consentimento ativo — os demais são pulados no envio.
  const channel = campaign?.channel ?? "WHATSAPP";
  let variantMessages = previews.map((p) => p.text);
  let withConsent: number | null = null;
  let smsCredits: number | null = null;
  if (campaign && channel !== "WHATSAPP") {
    const sampleUrl = `${getBaseUrl()}/api/u/<link-individual>`;
    const templates = [campaign.messageTemplate, ...campaign.messageVariants];
    if (channel === "EMAIL") {
      variantMessages = templates.map((t) => {
        const built = buildEmailContent({ subject: campaign.subject ?? "", template: t, variables: vars, technicalDirector: rt, unsubscribeUrl: sampleUrl });
        return `Assunto: ${built.subject}\n\n${built.text}`;
      });
    } else {
      const built = templates.map((t) => buildSmsContent({ template: t, variables: vars, technicalDirector: rt, unsubscribeUrl: sampleUrl }));
      variantMessages = built.map((b) => b.text);
      smsCredits = Math.max(...built.map((b) => b.credits));
    }
    const pendingAddresses = await prisma.broadcastRecipient.findMany({ where: { campaignId, status: "PENDING" }, select: { phone: true } });
    const consents = await prisma.channelConsent.findMany({
      where: { clinicId, channel, address: { in: pendingAddresses.map((r) => r.phone) } },
      select: { consentAt: true, revokedAt: true },
    });
    withConsent = consents.filter((c) => channelSendDecision({ consentAt: c.consentAt, revokedAt: c.revokedAt }) === "ENVIAR").length;
  }
  // API oficial: sai o texto do modelo aprovado, com os campos {{n}} preenchidos.
  const usesTemplate = Boolean(campaign?.cloudTemplateName);
  if (campaign?.cloudTemplateName) {
    const built = buildTemplateParams(campaign.cloudTemplateParams, vars);
    variantMessages = [built.ok ? renderTemplatePreview(campaign.cloudTemplateBody ?? "", built.params) : `⚠ ${built.error}`];
  }
  return {
    pending,
    channel,
    withConsent,
    smsCredits,
    samplePhone: first?.phone ?? null,
    sampleMessage: variantMessages[0] ?? "",
    /** Todas as variações montadas (a 1ª é a principal). */
    variantMessages,
    missingTechnicalDirector: !isReschedule && !rt,
    unknownVariables: usesTemplate ? [] : [...new Set(previews.flatMap((p) => p.unknownVariables))],
    unfilled: usesTemplate ? [] : [...new Set(previews.flatMap((p) => p.unfilled))],
    templateName: campaign?.cloudTemplateName ?? null,
    hasImage: !usesTemplate && Boolean(campaign?.imagePath),
    attachmentKind: !usesTemplate && campaign?.imagePath ? attachmentKindOf(campaign.imageMimeType) : null,
    attachmentName: !usesTemplate ? campaign?.attachmentName ?? null : null,
    lowPriority: Boolean(campaign?.lowPriority),
    ...estimateCampaignFinish({ pending, sentToday, now: new Date(), sharing: campaign?.lowPriority ? 1 : 1 + otherActive }),
    remindersOn: await clinicRemindersActive(clinicId, new Date()),
    isReschedule,
    urgentLastAt: isReschedule && pending > 0 ? urgentSendTimes(pending, new Date()).at(-1)?.toISOString() ?? null : null,
    needsCall: isReschedule
      ? buildCallList(
          await prisma.broadcastRecipient.findMany({
            where: { campaignId },
            orderBy: { createdAt: "asc" },
            select: { id: true, status: true, sentAt: true, phone: true, variables: true, calledAt: true },
          }),
          new Date()
        )
      : [],
  };
}

/** Devolve as falhas pra fila e deixa a campanha pausada — a recepção confere e clica
 * em Retomar (passa pela confirmação de novo). */
export async function retryClinicCampaignFailures(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  const { count } = await prisma.broadcastRecipient.updateMany({
    where: { campaignId, status: "FAILED" },
    data: { status: "PENDING", errorMessage: null },
  });
  if (count > 0) await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  revalidatePath("/clinic/disparos");
  return { requeued: count };
}

/** Exclui um rascunho (nunca iniciado). */
export async function deleteClinicDraftCampaign(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  const c = await prisma.broadcastCampaign.findUnique({ where: { id: campaignId }, select: { status: true } });
  if (c?.status !== "DRAFT") throw new Error("Só dá para excluir campanha que ainda não começou.");
  await prisma.$transaction([
    prisma.broadcastRecipient.deleteMany({ where: { campaignId } }),
    prisma.broadcastCampaign.delete({ where: { id: campaignId } }),
  ]);
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

/** Copia uma campanha (mesmo texto, imagem e público) como rascunho novo — serve
 * também pra "editar" um rascunho: duplica, ajusta e exclui o antigo. */
export async function getClinicCampaignForDuplicate(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  const c = await prisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
    select: { name: true, messageTemplate: true, messageVariants: true, cloudTemplateName: true, cloudTemplateParams: true, recipients: { select: { phone: true, variables: true } } },
  });
  if (!c) throw new Error("Campanha não encontrada");
  return {
    name: `${c.name} (cópia)`,
    template: c.messageTemplate,
    variants: c.messageVariants,
    cloudTemplateName: c.cloudTemplateName,
    cloudTemplateParams: c.cloudTemplateParams,
    recipients: c.recipients.map((r) => ({ phone: r.phone, variables: (r.variables ?? {}) as Record<string, string> })),
  };
}

/** Baixa prioridade: a campanha pausa sozinha enquanto houver lembrete de confirmação
 * ou outra campanha da clínica na fila (ver lowPriorityMustYield). */
export async function setClinicCampaignLowPriority(campaignId: string, lowPriority: boolean) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { lowPriority } });
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

/** Mirror de createBroadcastCampaign (admin-broadcast.ts) — mesma lógica de
 * dedup/opt-out, só que sempre pra própria clínica da sessão. */
export async function createClinicBroadcastCampaign(
  name: string,
  messageTemplate: string,
  recipients: ParsedBroadcastRecipient[],
  imageFormData?: FormData,
  /** Até 2 variações além da mensagem principal (sorteadas por destinatário). */
  extraVariants: string[] = [],
  /** API oficial: modelo aprovado + o que vai em cada {{n}}. */
  cloudTemplate?: { name: string; params: string[] }
) {
  const { clinicId, userId } = await requireClinicSession();
  const cloud = await getClinicCloudBroadcastSetup();
  let templateData: { cloudTemplateName: string; cloudTemplateLanguage: string; cloudTemplateBody: string; cloudTemplateParams: string[] } | null = null;
  if (cloud.active) {
    // Fora da janela de 24 h a Meta só aceita modelo aprovado.
    const tpl = cloud.templates.find((t) => t.name === cloudTemplate?.name);
    if (!tpl) throw new Error("Escolha um modelo aprovado pela Meta — na API oficial não dá para disparar texto livre.");
    const params = (cloudTemplate?.params ?? []).slice(0, tpl.variableCount).map((p) => p.trim());
    const problem = checkTemplateParamSources(tpl.variableCount, params, Object.keys(recipients[0]?.variables ?? {}));
    if (problem) throw new Error(problem);
    templateData = { cloudTemplateName: tpl.name, cloudTemplateLanguage: tpl.language, cloudTemplateBody: tpl.bodyText, cloudTemplateParams: params };
    // O texto da campanha vira o do modelo (lista, relatório e duplicar mostram isso).
    messageTemplate = tpl.bodyText;
    extraVariants = [];
    imageFormData = undefined;
  }

  const trimmedName = name.trim();
  const trimmedTemplate = messageTemplate.trim();
  if (!trimmedName || !trimmedTemplate) {
    throw new Error("Preencha o nome da campanha e o texto da mensagem.");
  }
  const checked = normalizeBroadcastVariants(trimmedTemplate, extraVariants);
  if (!checked.ok) throw new Error(checked.error);
  if (recipients.length === 0) {
    throw new Error("A lista de destinatários está vazia — confira o CSV.");
  }

  // Anexo opcional: imagem ou documento (PDF, Word, Excel). A chave "image" é a antiga e
  // continua valendo.
  const attachmentFile = imageFormData?.get("attachment") ?? imageFormData?.get("image");
  let attachmentBuffer: Buffer | null = null;
  let attachment: { mimeType: string; fileName: string } | null = null;
  if (attachmentFile instanceof File && attachmentFile.size > 0) {
    const checked = checkBroadcastAttachment({ name: attachmentFile.name, type: attachmentFile.type, size: attachmentFile.size });
    if (!checked.ok) throw new Error(checked.error);
    attachmentBuffer = Buffer.from(await attachmentFile.arrayBuffer());
    attachment = { mimeType: checked.mimeType, fileName: checked.fileName };
  }

  const seenPhones = new Set<string>();
  const normalized = recipients
    .map((r) => ({ ...r, phone: formatToWhatsAppNumber(r.phone) }))
    .filter((r) => {
      if (!r.phone || seenPhones.has(r.phone)) return false;
      seenPhones.add(r.phone);
      return true;
    });

  const optedOutPhones = new Set(
    (await prisma.contact.findMany({
      where: { phone: { in: normalized.map((r) => r.phone) }, optedOutOfBroadcastsAt: { not: null } },
      select: { phone: true },
    })).map((c) => c.phone)
  );

  const campaign = await prisma.broadcastCampaign.create({
    data: {
      clinicId,
      name: trimmedName,
      messageTemplate: trimmedTemplate,
      messageVariants: checked.variants.slice(1),
      ...(templateData ?? {}),
      createdByUserId: userId,
      recipients: {
        create: normalized.map((r) => ({
          phone: r.phone,
          variables: r.variables,
          status: optedOutPhones.has(r.phone) ? "SKIPPED_OPT_OUT" : "PENDING",
        })),
      },
    },
  });

  if (attachmentBuffer && attachment) {
    const uploaded = await uploadWhatsAppMedia(campaign.id, attachmentBuffer, attachment.mimeType);
    if (!uploaded) {
      throw new Error("Campanha criada, mas não foi possível subir o anexo. Duplique a campanha, anexe o arquivo de novo e exclua o rascunho antigo.");
    }
    await prisma.broadcastCampaign.update({
      where: { id: campaign.id },
      data: { imagePath: uploaded.path, imageMimeType: attachment.mimeType, attachmentName: attachment.fileName },
    });
  }

  revalidatePath("/clinic/disparos");
  return { success: true as const, campaignId: campaign.id };
}

/** Checa posse antes de iniciar/pausar — a versão admin não precisa (admin já pode
 * mexer em qualquer clínica), mas aqui uma clínica não pode tocar campanha de outra. */
async function assertClinicOwnsCampaign(campaignId: string, clinicId: string) {
  const campaign = await prisma.broadcastCampaign.findUnique({ where: { id: campaignId }, select: { clinicId: true } });
  if (!campaign || campaign.clinicId !== clinicId) {
    throw new Error("Campanha não encontrada");
  }
}

export async function startClinicBroadcastCampaign(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  // CFM: campanha de marketing sem responsável técnico (nome + CRM) não inicia.
  const c = await prisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
    select: { tagOnSend: true, channel: true, cloudTemplateName: true, clinic: { select: { technicalDirectorName: true, technicalDirectorCrm: true } } },
  });
  if (c && c.channel === "WHATSAPP" && !c.cloudTemplateName && (await getClinicCloudBroadcastSetup()).active) {
    return { success: false as const, error: "A clínica usa a API oficial: duplique a campanha e escolha um modelo aprovado pela Meta." };
  }
  if (c && c.tagOnSend !== RESCHEDULE_PENDING_TAG && !technicalDirectorLine(c.clinic.technicalDirectorName, c.clinic.technicalDirectorCrm)) {
    return { success: false as const, error: "Cadastre o responsável técnico (nome e CRM) em Configurações antes de iniciar a campanha." };
  }
  // SMS e e-mail dependem de chaves do provedor no servidor: sem elas a campanha ficaria
  // "em andamento" sem enviar nada.
  if (c && c.channel !== "WHATSAPP") {
    const missing = missingChannelConfig(c.channel);
    if (missing.length > 0) {
      return { success: false as const, error: `O envio por ${c.channel === "SMS" ? "SMS" : "e-mail"} ainda não está configurado no servidor (faltam: ${missing.join(", ")}). Peça ao administrador.` };
    }
  }
  await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { status: "RUNNING" } });
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

export async function pauseClinicBroadcastCampaign(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

/** Aviso de remarcação em massa — médico desmarcou a agenda de um dia, avisa todos os
 * pacientes agendados com ele naquela data de uma vez. Monta os destinatários a partir
 * dos próprios agendamentos (em vez de CSV manual) e já entra `RUNNING` na hora —
 * diferente de createClinicBroadcastCampaign, que sempre nasce rascunho — porque o
 * cenário é urgente por natureza (recepção já decidiu avisar ao abrir o modal).
 * `tagOnSend` faz o dispatcher (src/lib/broadcast.ts) marcar e reabrir cada conversa
 * assim que a mensagem sai (ver RESCHEDULE_PENDING_TAG). */
export async function createRescheduleBroadcast(doctorName: string, date: Date, messageTemplate: string) {
  const { clinicId, userId } = await requireClinicSession();

  const trimmedTemplate = messageTemplate.trim();
  if (!trimmedTemplate) {
    throw new Error("Preencha o texto da mensagem.");
  }

  const appointments = await prisma.appointment.findMany({
    where: {
      clinicProcedure: { clinicId },
      doctorName,
      date,
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    select: { patientName: true, patientPhone: true, timeSlot: true },
    orderBy: { timeSlot: "asc" },
  });
  if (appointments.length === 0) {
    throw new Error("Nenhum paciente agendado com esse médico nessa data.");
  }
  const dataIso = date.toISOString().slice(0, 10);

  const dateLabel = formatDate(date);
  const seenPhones = new Set<string>();
  const normalized = appointments
    // horario/dataIso: base da lista "Precisam de ligação" (quem não recebe antes da consulta).
    .map((a) => ({
      phone: formatToWhatsAppNumber(a.patientPhone),
      variables: { nome: a.patientName, medico: doctorName, data: dateLabel, horario: a.timeSlot ?? "", dataIso },
    }))
    .filter((r) => {
      if (!r.phone || seenPhones.has(r.phone)) return false;
      seenPhones.add(r.phone);
      return true;
    });

  const optedOutPhones = new Set(
    (await prisma.contact.findMany({
      where: { phone: { in: normalized.map((r) => r.phone) }, optedOutOfBroadcastsAt: { not: null } },
      select: { phone: true },
    })).map((c) => c.phone)
  );

  const campaign = await prisma.broadcastCampaign.create({
    data: {
      clinicId,
      name: `Remarcação — Dr(a). ${doctorName} — ${dateLabel}`,
      messageTemplate: trimmedTemplate,
      createdByUserId: userId,
      status: "RUNNING",
      tagOnSend: RESCHEDULE_PENDING_TAG,
      recipients: {
        create: normalized.map((r) => ({
          phone: r.phone,
          variables: r.variables,
          status: optedOutPhones.has(r.phone) ? "SKIPPED_OPT_OUT" : "PENDING",
        })),
      },
    },
  });

  revalidatePath("/clinic/disparos");
  revalidatePath("/clinic/inbox");
  const pendingCount = normalized.filter((r) => !optedOutPhones.has(r.phone)).length;
  const times = urgentSendTimes(pendingCount, new Date());
  return {
    success: true as const,
    campaignId: campaign.id,
    recipientCount: normalized.length,
    lastAt: times.length ? times[times.length - 1].toISOString() : null,
  };
}

/** Recepção marca que ligou (ou desmarca) pra um paciente da lista "Precisam de ligação". */
export async function setRecipientCalled(recipientId: string, called: boolean) {
  const { clinicId } = await requireClinicSession();
  const r = await prisma.broadcastRecipient.findUnique({ where: { id: recipientId }, select: { campaign: { select: { clinicId: true } } } });
  if (!r || r.campaign.clinicId !== clinicId) throw new Error("Paciente não encontrado.");
  await prisma.broadcastRecipient.update({ where: { id: recipientId }, data: { calledAt: called ? new Date() : null } });
  revalidatePath("/clinic/disparos");
  return { success: true as const };
}

export type BridgeAudienceFilters = {
  sexo?: "F" | "M";
  /** Última marcação nos últimos N meses. */
  months: number;
  minAge?: number;
  maxAge?: number;
};

/** Prévia do público tirado direto do sistema da clínica (Firebird via bridge) — sem CSV.
 * Devolve os destinatários prontos pra createClinicBroadcastCampaign, que continua sendo
 * o único lugar que cria campanha (mesma dedup/opt-out/imagem). */
export async function previewBridgeAudience(filters: BridgeAudienceFilters) {
  const { clinicId } = await requireClinicSession();
  const months = Math.min(Math.max(Math.round(filters.months) || 12, 1), 60);
  const since = new Date();
  since.setMonth(since.getMonth() - months);

  const patients = await fetchBridgeCampaignPatients(clinicId, {
    sexo: filters.sexo,
    desde: since.toISOString().slice(0, 10),
  });
  const optedOutPhones = new Set(
    (await prisma.contact.findMany({ where: { optedOutOfBroadcastsAt: { not: null }, phone: { not: null } }, select: { phone: true } }))
      .map((c) => c.phone)
      .filter((p): p is string => !!p)
  );
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { campaignExcludedPatientIds: true } });
  const { recipients, stats } = buildCampaignAudience(patients, {
    minAge: filters.minAge || undefined,
    maxAge: filters.maxAge || undefined,
    optedOutPhones,
    excludedPatientIds: new Set(clinic.campaignExcludedPatientIds),
  });

  return {
    stats: { ...stats, recipients: recipients.length },
    recipients,
    // Amostra pra conferência na tela — telefone parcialmente oculto.
    sample: recipients.slice(0, 8).map((r) => ({
      saudacao: r.variables.saudacao,
      phone: `${r.phone.slice(0, 4)} ••••• ${r.phone.slice(-4)}`,
    })),
  };
}

/** Clínica tem integração com o sistema hospitalar ativa? (mostra a opção na tela) */
export async function clinicHasBridgeAudience() {
  const { clinicId } = await requireClinicSession();
  const integration = await prisma.hospitalIntegration.findUnique({ where: { clinicId }, select: { active: true } });
  return Boolean(integration?.active);
}

/** Lista de exclusão de campanhas (códigos de paciente do sistema da clínica). */
export async function getCampaignExclusions() {
  const { clinicId } = await requireClinicSession();
  const clinic = await prisma.clinic.findUniqueOrThrow({ where: { id: clinicId }, select: { campaignExcludedPatientIds: true } });
  return clinic.campaignExcludedPatientIds;
}

/** Substitui a lista inteira — aceita códigos separados por vírgula, espaço ou linha. */
export async function setCampaignExclusions(raw: string) {
  const { clinicId } = await requireClinicManager();
  const ids = [...new Set(raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean).map(Number))];
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new Error("Use só os códigos numéricos dos pacientes.");
  if (ids.length > 5000) throw new Error("Lista grande demais.");
  await prisma.clinic.update({ where: { id: clinicId }, data: { campaignExcludedPatientIds: ids.sort((a, b) => a - b) } });
  return ids.length;
}

export type ClinicCloudTemplate = { name: string; language: string; category: string; bodyText: string; variableCount: number };

/** API oficial ativa? Se sim, os modelos APROVADOS da clínica (só eles podem ser disparados). */
export async function getClinicCloudBroadcastSetup(): Promise<{ active: boolean; templates: ClinicCloudTemplate[]; error?: string }> {
  const { clinicId } = await requireClinicSession();
  const account = await prisma.whatsappCloudAccount.findUnique({ where: { clinicId }, select: { active: true, wabaId: true, accessToken: true } });
  if (!account?.active) return { active: false, templates: [] };
  let token: string;
  try {
    token = decryptToken(account.accessToken);
  } catch {
    return { active: true, templates: [], error: "Não foi possível ler o acesso da API oficial. Reconecte o WhatsApp." };
  }
  const r = await listCloudTemplates(account.wabaId, token);
  if (!r.success) return { active: true, templates: [], error: r.error };
  return {
    active: true,
    templates: r.data.data
      .filter((t) => t.status === "APPROVED")
      .map((t) => {
        const body = (t as typeof t & { components?: { type: string; text?: string }[] }).components?.find((c) => c.type === "BODY")?.text ?? "";
        return { name: t.name, language: t.language, category: t.category, bodyText: body, variableCount: new Set(body.match(/\{\{\d+\}\}/g) ?? []).size };
      }),
  };
}
