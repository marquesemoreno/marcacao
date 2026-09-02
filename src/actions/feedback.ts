"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { sendWhatsAppMessage, sendWhatsAppMedia } from "@/lib/whatsapp";
import { uploadWhatsAppMedia, getSignedMediaUrl } from "@/lib/whatsapp-media";
import { buildFeedbackMessage, type FeedbackType } from "@/lib/feedback";

const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024;

type FeedbackResult = { success: true } | { success: false; error: string };

/** Atendente reporta bug/sugestão pelo widget flutuante do painel da clínica — vira
 * uma mensagem de WhatsApp direto pro número de operação (FEEDBACK_WHATSAPP_NUMBER),
 * sem tela de admin nova pra abrir (decisão do usuário: usar o canal que já monitora).
 * Retorna um objeto em vez de lançar exceção pros casos esperados — Next.js redige a
 * mensagem de erro de exceções lançadas em Server Action em build de produção, então
 * "throw" aqui viraria sempre o texto genérico "Server Components render..." pro
 * atendente, escondendo até erro de validação simples. */
export async function submitFeedbackReport(formData: FormData): Promise<FeedbackResult> {
  const { clinicId, userId } = await requireClinicSession();

  const type = formData.get("type");
  const description = String(formData.get("description") ?? "").trim();
  if (type !== "BUG" && type !== "SUGGESTION") {
    return { success: false, error: "Tipo de relato inválido." };
  }
  if (description.length < 5) {
    return { success: false, error: "Descreva com um pouco mais de detalhe (mínimo 5 caracteres)." };
  }

  const targetPhone = process.env.FEEDBACK_WHATSAPP_NUMBER;
  if (!targetPhone) {
    return { success: false, error: "Envio de feedback não está configurado (FEEDBACK_WHATSAPP_NUMBER ausente)." };
  }
  // Instância que ENVIA o relato — não é a instância global (histórico de ficar
  // desconectada) nem necessariamente a da própria clínica do atendente (a maioria
  // não tem instância dedicada). Configurável por env pra trocar sem precisar de
  // deploy quando a numeração mudar (ex: quando a TIVDC tiver instância própria).
  const senderClinicId = process.env.FEEDBACK_SENDER_CLINIC_ID || undefined;

  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { tradeName: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
  ]);

  const text = buildFeedbackMessage({
    type: type as FeedbackType,
    description,
    clinicName: clinic?.tradeName ?? "Clínica desconhecida",
    userName: user?.name ?? "Atendente",
  });

  const imageFile = formData.get("image");
  let result: { success: boolean; skipped: boolean };

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(imageFile.type)) {
      return { success: false, error: "Tipo de imagem não suportado. Envie JPEG, PNG, WEBP ou GIF." };
    }
    if (imageFile.size > MAX_IMAGE_SIZE_BYTES) {
      return { success: false, error: "Imagem muito grande. O limite é 15 MB." };
    }

    let uploaded: { path: string; sizeBytes: number } | null;
    try {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      uploaded = await uploadWhatsAppMedia(`feedback-${Date.now()}`, buffer, imageFile.type);
    } catch (error) {
      console.error("Falha ao ler/subir a imagem do relato de feedback:", error);
      uploaded = null;
    }
    if (!uploaded) {
      return { success: false, error: "Não foi possível processar a imagem. Tente enviar sem anexo." };
    }

    const mediaUrl = await getSignedMediaUrl(uploaded.path);
    if (!mediaUrl) {
      return { success: false, error: "Não foi possível gerar o link da imagem. Tente enviar sem anexo." };
    }
    result = await sendWhatsAppMedia(targetPhone, mediaUrl, imageFile.type, "relato.jpg", text, "feedback.report", senderClinicId);
  } else {
    result = await sendWhatsAppMessage(targetPhone, text, "feedback.report", senderClinicId);
  }

  if (!result.success && !result.skipped) {
    return { success: false, error: "Não foi possível enviar o relato agora. Tente novamente em instantes." };
  }

  return { success: true };
}
