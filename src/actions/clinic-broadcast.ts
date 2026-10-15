"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { buildBroadcastMessage, type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { campaignSituation, estimateCampaignFinish, patientsNeedingCall, startOfBrazilDay, unfilledPlaceholders, unknownTemplateVariables, urgentSendTimes } from "@/lib/broadcast-schedule";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { formatDate } from "@/lib/format";
import { fetchBridgeCampaignPatients } from "@/lib/hospital-bridge";
import { lastAutomatedSend } from "@/lib/automated-pacing-server";
import { buildCampaignAudience } from "@/lib/campaign-audience";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // mesmo limite já usado pra mídia do inbox

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
        select: { id: true, status: true, sentAt: true, errorMessage: true, phone: true, variables: true, calledAt: true },
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
    const skipped = c.recipients.filter((r) => r.status === "SKIPPED_OPT_OUT").length;
    const pending = c.recipients.filter((r) => r.status === "PENDING").length;
    const sentToday = c.recipients.filter((r) => r.status === "SENT" && r.sentAt && r.sentAt >= dayStart).length;
    const yielding = c.lowPriority && highPriorityPending;
    const isReschedule = c.tagOnSend === RESCHEDULE_PENDING_TAG;
    // Campanhas normais ativas se revezam no mesmo ritmo da clínica (ver automated-pacing).
    const sharing = c.lowPriority ? 1 : Math.max(1, highPriorityActive);
    const estimate = isReschedule ? { businessDays: 0, finishIso: null } : estimateCampaignFinish({ pending, sentToday, now, sharing });
    // Com lembretes de confirmação ativos, nas manhãs eles têm a vez — o fim real pode
    // cair mais tarde: a tela mostra uma faixa ("entre X e Y") em vez de uma data só.
    const late = !isReschedule && remindersOn && !c.lowPriority
      ? estimateCampaignFinish({ pending, sentToday, now, sharing: sharing + 1 })
      : null;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      hasImage: Boolean(c.imagePath),
      lowPriority: c.lowPriority,
      total: c._count.recipients,
      sent,
      failed: failedList.length,
      failureReasons: [...new Set(failedList.map((r) => r.errorMessage).filter((m): m is string => !!m))].slice(0, 3),
      failures: failedList.slice(0, 30).map((r) => ({ phone: r.phone, reason: r.errorMessage })),
      skipped,
      pending,
      situation: isReschedule && c.status === "RUNNING" && pending > 0
        ? { tone: "ok" as const, text: "Enviando aviso urgente — 1 a cada 4–6 min, das 8h às 18h" }
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
    select: { messageTemplate: true, imagePath: true, lowPriority: true, tagOnSend: true },
  });
  const isReschedule = campaign?.tagOnSend === RESCHEDULE_PENDING_TAG;
  const otherActive = await prisma.broadcastCampaign.count({
    where: {
      clinicId,
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
  return {
    pending,
    samplePhone: first?.phone ?? null,
    sampleMessage: campaign ? buildBroadcastMessage(campaign.messageTemplate, vars) : "",
    unknownVariables: campaign ? unknownTemplateVariables(campaign.messageTemplate, vars) : [],
    unfilled: campaign ? unfilledPlaceholders(campaign.messageTemplate) : [],
    hasImage: Boolean(campaign?.imagePath),
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
    select: { name: true, messageTemplate: true, recipients: { select: { phone: true, variables: true } } },
  });
  if (!c) throw new Error("Campanha não encontrada");
  return {
    name: `${c.name} (cópia)`,
    template: c.messageTemplate,
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
  imageFormData?: FormData
) {
  const { clinicId, userId } = await requireClinicSession();

  const trimmedName = name.trim();
  const trimmedTemplate = messageTemplate.trim();
  if (!trimmedName || !trimmedTemplate) {
    throw new Error("Preencha o nome da campanha e o texto da mensagem.");
  }
  if (recipients.length === 0) {
    throw new Error("A lista de destinatários está vazia — confira o CSV.");
  }

  const imageFile = imageFormData?.get("image");
  let imageBuffer: Buffer | null = null;
  let imageMimeType: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(imageFile.type)) {
      throw new Error("Tipo de imagem não suportado. Envie JPEG, PNG, WEBP ou GIF.");
    }
    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      throw new Error("Imagem muito grande. O limite é 15 MB.");
    }
    imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    imageMimeType = imageFile.type;
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

  if (imageBuffer && imageMimeType) {
    const uploaded = await uploadWhatsAppMedia(campaign.id, imageBuffer, imageMimeType);
    if (!uploaded) {
      throw new Error("Campanha criada, mas não foi possível subir a imagem. Duplique a campanha, anexe a imagem de novo e exclua o rascunho antigo.");
    }
    await prisma.broadcastCampaign.update({
      where: { id: campaign.id },
      data: { imagePath: uploaded.path, imageMimeType },
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
  const { clinicId } = await requireClinicSession();
  const ids = [...new Set(raw.split(/[\s,;]+/).map((t) => t.trim()).filter(Boolean).map(Number))];
  if (ids.some((n) => !Number.isInteger(n) || n <= 0)) throw new Error("Use só os códigos numéricos dos pacientes.");
  if (ids.length > 5000) throw new Error("Lista grande demais.");
  await prisma.clinic.update({ where: { id: clinicId }, data: { campaignExcludedPatientIds: ids.sort((a, b) => a - b) } });
  return ids.length;
}
