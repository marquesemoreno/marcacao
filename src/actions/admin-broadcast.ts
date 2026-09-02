"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";
import { type ParsedBroadcastRecipient } from "@/lib/broadcast-csv";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // mesmo limite já usado pra mídia do inbox

export async function listBroadcastCampaigns(clinicId: string) {
  await requireAdminSession();
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

/** Cria a campanha já como DRAFT — quem já optou por sair de disparos (Contact.optedOutOfBroadcastsAt)
 * nasce marcado SKIPPED_OPT_OUT de cara, nunca chega a ser processado pelo cron.
 * `imageFormData` é opcional (campo "image"), só quando a campanha manda foto junto. */
export async function createBroadcastCampaign(
  clinicId: string,
  name: string,
  messageTemplate: string,
  recipients: ParsedBroadcastRecipient[],
  imageFormData?: FormData
) {
  const { userId } = await requireAdminSession();

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

  // Normaliza e dedupa por telefone (o mesmo contato pode aparecer 2x no CSV) antes
  // de checar opt-out — a checagem final e definitiva ainda acontece de novo no envio
  // (dispatchNextBatch), essa aqui só evita já nascer com registro duplicado.
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

  // Upload depois de criar a campanha: o caminho no Storage usa o id dela pra
  // namespacing (mesmo padrão de uploadWhatsAppMedia com conversationId no inbox).
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

  revalidatePath("/admin/disparos");
  return { success: true as const, campaignId: campaign.id };
}

export async function startBroadcastCampaign(campaignId: string) {
  await requireAdminSession();
  await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { status: "RUNNING" } });
  revalidatePath("/admin/disparos");
  return { success: true as const };
}

export async function pauseBroadcastCampaign(campaignId: string) {
  await requireAdminSession();
  await prisma.broadcastCampaign.update({ where: { id: campaignId }, data: { status: "PAUSED" } });
  revalidatePath("/admin/disparos");
  return { success: true as const };
}
