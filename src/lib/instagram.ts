import "server-only";
import { prisma } from "@/lib/prisma";
import { uploadWhatsAppMedia } from "@/lib/whatsapp-media";

/** Instagram API com Instagram Login (graph.instagram.com) — não exige página do
 * Facebook vinculada. Token de longa duração da conta profissional em
 * InstagramAccount.accessToken (cadastro manual pelo admin por enquanto). */
const GRAPH_BASE = "https://graph.instagram.com/v23.0";

export async function getInstagramAccountForClinic(clinicId: string) {
  return prisma.instagramAccount.findFirst({ where: { clinicId, active: true } });
}

export type InstagramSendResult = { success: true; mid: string | null } | { success: false; error: string; code?: number };

/** POST /me/messages. `humanAgent`: fora das 24h e dentro de 7 dias a Meta só aceita
 * com a tag HUMAN_AGENT (ver messagingWindowState em instagram-webhook.ts). Sempre
 * grava em webhookLog, igual ao envio de WhatsApp. */
export async function sendInstagramMessage(
  clinicId: string,
  recipientId: string,
  text: string,
  options: { humanAgent?: boolean; event?: string } = {}
): Promise<InstagramSendResult> {
  const account = await getInstagramAccountForClinic(clinicId);
  if (!account) return { success: false, error: "Clínica sem conta de Instagram conectada." };

  const body = {
    recipient: { id: recipientId },
    message: { text },
    ...(options.humanAgent ? { messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT" } : {}),
  };

  let status = 0;
  let json: { message_id?: string; error?: { message?: string; code?: number } } | null = null;
  try {
    const res = await fetch(`${GRAPH_BASE}/me/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${account.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    status = res.status;
    json = await res.json().catch(() => null);
  } catch (error) {
    json = { error: { message: error instanceof Error ? error.message : "Falha de rede" } };
  }

  const ok = status >= 200 && status < 300 && !json?.error;
  await prisma.webhookLog
    .create({
      data: {
        event: options.event ?? "instagram.outbound",
        payload: { clinicId, recipientId, humanAgent: Boolean(options.humanAgent), response: json ?? null },
        status: ok ? "SUCCESS" : "FAILED",
        responseCode: status || null,
      },
    })
    .catch(() => {});

  return ok
    ? { success: true, mid: json?.message_id ?? null }
    : { success: false, error: json?.error?.message ?? `HTTP ${status}`, code: json?.error?.code };
}

/** Nome/@username/foto do lead — só no primeiro contato. Falha não bloqueia nada. */
export async function fetchInstagramProfile(igsid: string, accessToken: string) {
  try {
    const url = new URL(`${GRAPH_BASE}/${igsid}`);
    url.searchParams.set("fields", "name,username,profile_pic");
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const j = (await res.json()) as { name?: string; username?: string; profile_pic?: string };
    return { name: j.name ?? null, username: j.username ?? null, profilePic: j.profile_pic ?? null };
  } catch {
    return null;
  }
}

/** A URL de mídia da Meta expira (story em 24h) — baixa na hora e guarda no mesmo
 * bucket privado do WhatsApp. */
export async function storeInstagramMedia(conversationId: string, url: string) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0].trim() || "application/octet-stream";
    const buffer = Buffer.from(await res.arrayBuffer());
    const uploaded = await uploadWhatsAppMedia(conversationId, buffer, mimeType);
    return uploaded ? { ...uploaded, mimeType } : null;
  } catch {
    return null;
  }
}
