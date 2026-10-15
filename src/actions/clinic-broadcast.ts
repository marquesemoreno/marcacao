"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { buildBroadcastMessage, type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { campaignSituation, estimateCampaignFinish, startOfBrazilDay, unknownTemplateVariables } from "@/lib/broadcast-schedule";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { formatDate } from "@/lib/format";
import { fetchBridgeCampaignPatients } from "@/lib/hospital-bridge";
import { buildCampaignAudience } from "@/lib/campaign-audience";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // mesmo limite já usado pra mídia do inbox

/** Mirror de listBroadcastCampaigns (admin-broadcast.ts) — clinicId vem da sessão,
 * não é parâmetro (a clínica só pode ver as próprias campanhas). */
export async function listClinicBroadcastCampaigns() {
  const { clinicId } = await requireClinicSession();
  const now = new Date();
  const dayStart = startOfBrazilDay(now);
  const campaigns = await prisma.broadcastCampaign.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { recipients: true } },
      recipients: { select: { status: true, sentAt: true, errorMessage: true } },
    },
  });
  // Alguma campanha normal com gente na fila? (a de baixa prioridade cede a vez — ver
  // lowPriorityMustYield em automated-pacing.ts)
  const highPriorityPending = campaigns.some(
    (c) => c.status === "RUNNING" && !c.lowPriority && c.recipients.some((r) => r.status === "PENDING")
  );

  return campaigns.map((c) => {
    const sent = c.recipients.filter((r) => r.status === "SENT").length;
    const failedList = c.recipients.filter((r) => r.status === "FAILED");
    const skipped = c.recipients.filter((r) => r.status === "SKIPPED_OPT_OUT").length;
    const pending = c.recipients.filter((r) => r.status === "PENDING").length;
    const sentToday = c.recipients.filter((r) => r.status === "SENT" && r.sentAt && r.sentAt >= dayStart).length;
    const yielding = c.lowPriority && highPriorityPending;
    const isReschedule = c.tagOnSend === RESCHEDULE_PENDING_TAG;
    const estimate = isReschedule ? { businessDays: 0, finishIso: null } : estimateCampaignFinish({ pending, sentToday, now });
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
      skipped,
      pending,
      situation: isReschedule && c.status === "RUNNING" && pending > 0
        ? { tone: "ok" as const, text: "Enviando aviso urgente de remarcação" }
        : campaignSituation({ status: c.status, pending, sentToday, yielding, now }),
      finishIso: c.status === "COMPLETED" ? null : estimate.finishIso,
      businessDays: estimate.businessDays,
      createdAt: c.createdAt,
    };
  });
}

/** Prévia antes de iniciar: quantos vão receber, a mensagem como o 1º destinatário
 * recebe (variáveis preenchidas + rodapé de saída) e a previsão de término. */
export async function getClinicCampaignStartPreview(campaignId: string) {
  const { clinicId } = await requireClinicSession();
  await assertClinicOwnsCampaign(campaignId, clinicId);
  const campaign = await prisma.broadcastCampaign.findUnique({
    where: { id: campaignId },
    select: { messageTemplate: true, imagePath: true, lowPriority: true },
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
    hasImage: Boolean(campaign?.imagePath),
    lowPriority: Boolean(campaign?.lowPriority),
    ...estimateCampaignFinish({ pending, sentToday, now: new Date() }),
  };
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
    select: { patientName: true, patientPhone: true },
  });
  if (appointments.length === 0) {
    throw new Error("Nenhum paciente agendado com esse médico nessa data.");
  }

  const dateLabel = formatDate(date);
  const seenPhones = new Set<string>();
  const normalized = appointments
    .map((a) => ({ phone: formatToWhatsAppNumber(a.patientPhone), variables: { nome: a.patientName, medico: doctorName, data: dateLabel } }))
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
  return { success: true as const, campaignId: campaign.id, recipientCount: normalized.length };
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
