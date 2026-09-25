"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { formatDate } from "@/lib/format";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // mesmo limite já usado pra mídia do inbox

/** Mirror de listBroadcastCampaigns (admin-broadcast.ts) — clinicId vem da sessão,
 * não é parâmetro (a clínica só pode ver as próprias campanhas). */
export async function listClinicBroadcastCampaigns() {
  const { clinicId } = await requireClinicSession();
  const campaigns = await prisma.broadcastCampaign.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { recipients: true } },
      recipients: { select: { status: true } },
    },
  });

  return campaigns.map((c) => {
    const sent = c.recipients.filter((r) => r.status === "SENT").length;
    const failed = c.recipients.filter((r) => r.status === "FAILED").length;
    const skipped = c.recipients.filter((r) => r.status === "SKIPPED_OPT_OUT").length;
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      hasImage: Boolean(c.imagePath),
      total: c._count.recipients,
      sent,
      failed,
      skipped,
      createdAt: c.createdAt,
    };
  });
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
      throw new Error("Campanha criada, mas não foi possível subir a imagem. Tente editar e reenviar.");
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
