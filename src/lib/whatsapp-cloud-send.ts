import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import { downloadCloudMedia, sendCloudMedia, sendCloudTemplate, sendCloudText } from "@/lib/whatsapp-cloud";
import { cloudMediaKind } from "@/lib/cloud-media-kind";

/** Envio pela API oficial quando a clínica tem WhatsappCloudAccount ATIVA — os
 * sendWhatsApp* (whatsapp.ts) desviam pra cá antes de tentar a Evolution. Mesmo formato de
 * retorno, com keyId = wamid (o webhook da API oficial atualiza o status por ele). */
type SendResult = { success: boolean; skipped: boolean; responseCode?: number | null; keyId?: string };

export async function activeCloudAccount(clinicId: string | undefined) {
  if (!clinicId) return null;
  const a = await prisma.whatsappCloudAccount.findUnique({
    where: { clinicId },
    select: { active: true, phoneNumberId: true, accessToken: true },
  });
  if (!a?.active) return null;
  try {
    return { phoneNumberId: a.phoneNumberId, token: decryptToken(a.accessToken) };
  } catch {
    return null;
  }
}

async function log(event: string, payload: Record<string, unknown>, ok: boolean, error?: string) {
  await prisma.webhookLog
    .create({ data: { event, payload: { via: "cloud", ...payload, ...(error ? { error } : {}) }, status: ok ? "SUCCESS" : "FAILED", responseCode: null } })
    .catch(() => {});
}

function toResult(r: { success: true; data: { messages?: { id: string }[] } } | { success: false; error: string; code?: number }): SendResult {
  return r.success
    ? { success: true, skipped: false, responseCode: 200, keyId: r.data.messages?.[0]?.id }
    : { success: false, skipped: false, responseCode: r.code ?? null };
}

export async function cloudSendText(account: { phoneNumberId: string; token: string }, to: string, text: string, event: string) {
  const r = await sendCloudText(account.phoneNumberId, account.token, to, text);
  await log(event, { phone: to, text: text.slice(0, 200) }, r.success, r.success ? undefined : r.error);
  return toResult(r);
}

export async function cloudSendMedia(
  account: { phoneNumberId: string; token: string },
  to: string,
  media: { link: string; mimeType: string; caption?: string; fileName?: string },
  event: string
) {
  const r = await sendCloudMedia(account.phoneNumberId, account.token, to, {
    kind: cloudMediaKind(media.mimeType),
    link: media.link,
    caption: media.caption,
    filename: media.fileName,
  });
  await log(event, { phone: to, fileName: media.fileName }, r.success, r.success ? undefined : r.error);
  return toResult(r);
}

export async function cloudSendTemplate(
  account: { phoneNumberId: string; token: string },
  to: string,
  template: { name: string; language: string; bodyParams: string[] },
  event: string
) {
  const r = await sendCloudTemplate(account.phoneNumberId, account.token, to, template);
  await log(event, { phone: to, template: template.name }, r.success, r.success ? undefined : r.error);
  return toResult(r);
}

/** Lembrete D-1 na API oficial: conta ativa + modelo configurado. "missing" = conta ativa
 * sem modelo (não envia — texto livre seria recusado fora da janela de 24 h). */
export async function cloudReminderSetup(clinicId: string) {
  const a = await prisma.whatsappCloudAccount.findUnique({
    where: { clinicId },
    select: { active: true, phoneNumberId: true, accessToken: true, reminderTemplateName: true, reminderTemplateLanguage: true },
  });
  if (!a?.active) return null;
  if (!a.reminderTemplateName) return "missing" as const;
  return {
    account: { phoneNumberId: a.phoneNumberId, token: decryptToken(a.accessToken) },
    name: a.reminderTemplateName,
    language: a.reminderTemplateLanguage || "pt_BR",
  };
}

/** Mídia recebida pela API oficial, em base64 (mesmo formato do fetchMediaBase64 da Evolution). */
export async function fetchCloudMediaBase64(clinicId: string, mediaId: string): Promise<{ success: true; base64: string } | { success: false; error: string }> {
  const a = await prisma.whatsappCloudAccount.findUnique({ where: { clinicId }, select: { accessToken: true } });
  if (!a) return { success: false, error: "Clínica sem conta da API oficial" };
  const r = await downloadCloudMedia(mediaId, decryptToken(a.accessToken));
  return r.success ? { success: true, base64: r.data.base64 } : { success: false, error: r.error };
}
