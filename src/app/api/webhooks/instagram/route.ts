import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { formatFileSize } from "@/lib/format";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { reopenIfResolved } from "@/lib/conversation-reopen";
import { parseInstagramWebhook, verifyMetaSignature, type InstagramEvent } from "@/lib/instagram-webhook";
import { fetchInstagramProfile, storeInstagramMedia } from "@/lib/instagram";
import { INSTAGRAM_DIRECT_CHANNEL } from "@/lib/acquisition";

/** Webhook do Instagram Direct (Instagram API com Instagram Login). Grava no mesmo
 * formato de Conversation/Message do WhatsApp (channel INSTAGRAM), então o Inbox não
 * precisa saber de onde a mensagem veio. Env: INSTAGRAM_VERIFY_TOKEN (escolhido por nós,
 * informado no painel da Meta) e INSTAGRAM_APP_SECRET (assinatura do POST). */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.INSTAGRAM_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

async function log(payload: Prisma.InputJsonValue, status: string) {
  await prisma.webhookLog.create({ data: { event: "instagram.inbound", payload, status, responseCode: null } }).catch(() => {});
}

const ATTACHMENT_LABELS: Record<string, string> = {
  image: "📷 Imagem",
  audio: "🎤 Áudio",
  video: "🎬 Vídeo",
  story_mention: "📣 Mencionou a clínica no story",
  share: "🔗 Compartilhou uma publicação",
  ig_reel: "🎞️ Compartilhou um reel",
};

async function findOrCreateContact(igsid: string, accessToken: string) {
  const existing = await prisma.contact.findUnique({ where: { channel_externalId: { channel: "INSTAGRAM", externalId: igsid } } });
  if (existing) return existing;
  const profile = await fetchInstagramProfile(igsid, accessToken);
  // upsert: duas mensagens simultâneas do mesmo lead não podem criar dois contatos
  return prisma.contact.upsert({
    where: { channel_externalId: { channel: "INSTAGRAM", externalId: igsid } },
    update: {},
    create: {
      channel: "INSTAGRAM",
      externalId: igsid,
      name: profile?.name || (profile?.username ? `@${profile.username}` : "Lead do Instagram"),
      instagramUsername: profile?.username ?? null,
      photoUrl: profile?.profilePic ?? null,
      photoUpdatedAt: profile?.profilePic ? new Date() : null,
    },
  });
}

async function handleMessage(event: Extract<InstagramEvent, { kind: "message" }>) {
  const account = await prisma.instagramAccount.findFirst({ where: { igUserId: event.accountId, active: true } });
  if (!account) {
    await log({ reason: "conta de Instagram não cadastrada", accountId: event.accountId }, "IGNORED");
    return null;
  }
  // Mensagem que nós mesmos enviamos volta como echo — já está gravada com o mid.
  if (await prisma.message.findUnique({ where: { whatsappKeyId: event.mid }, select: { id: true } })) return null;

  const contact = await findOrCreateContact(event.userId, account.accessToken);
  let conversation = await prisma.conversation.findFirst({
    where: { clinicId: account.clinicId, contactId: contact.id, channel: "INSTAGRAM" },
    orderBy: { createdAt: "desc" },
  });
  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        clinicId: account.clinicId,
        contactId: contact.id,
        channel: "INSTAGRAM",
        status: "OPEN",
        lastMessageAt: event.timestamp,
        acquisitionChannel: INSTAGRAM_DIRECT_CHANNEL,
      },
    });
  }

  const direction = event.fromMe ? "OUTBOUND" : "INBOUND";
  const status = event.fromMe ? "SENT" : "DELIVERED";
  const rows: Prisma.MessageCreateManyInput[] = [];

  if (event.text) {
    rows.push({ conversationId: conversation.id, direction, status, content: event.text, createdAt: event.timestamp });
  }
  for (const att of event.attachments) {
    const label = ATTACHMENT_LABELS[att.type] ?? "📎 Anexo";
    const isMedia = ["image", "audio", "video", "story_mention"].includes(att.type) && att.url;
    const stored = isMedia ? await storeInstagramMedia(conversation.id, att.url!) : null;
    if (stored) {
      const isAudio = stored.mimeType.startsWith("audio/") || att.type === "audio";
      rows.push({
        conversationId: conversation.id,
        direction,
        status,
        createdAt: event.timestamp,
        content: att.type === "story_mention" ? label : "",
        type: isAudio ? "AUDIO" : "ATTACHMENT",
        mediaPath: stored.path,
        mimeType: stored.mimeType,
        ...(isAudio ? { audioDuration: "0:00" } : { attachmentName: `instagram-${att.type}`, attachmentSize: formatFileSize(stored.sizeBytes) }),
      });
    } else {
      rows.push({
        conversationId: conversation.id,
        direction,
        status,
        createdAt: event.timestamp,
        content: att.url && !isMedia ? `${label}: ${att.url}` : isMedia ? `${label} (não foi possível baixar a mídia)` : label,
      });
    }
  }
  if (rows.length === 0) return null;
  // mid fica na 1ª linha (deduplicação/ack de leitura); as demais ganham sufixo.
  rows.forEach((r, i) => (r.whatsappKeyId = i === 0 ? event.mid : `${event.mid}:${i}`));
  await prisma.message.createMany({ data: rows, skipDuplicates: true });

  await prisma.conversation.update({
    where: { id: conversation.id },
    data: {
      lastMessageAt: event.timestamp,
      ...(event.fromMe ? {} : { archivedAt: null, ...reopenIfResolved(conversation) }),
    },
  });
  return account.clinicId;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!verifyMetaSignature(rawBody, request.headers.get("x-hub-signature-256"), process.env.INSTAGRAM_APP_SECRET)) {
    await log({ reason: "assinatura inválida" }, "REJECTED");
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const touchedClinics = new Set<string>();
  // Sempre 200 depois da assinatura válida: a Meta reenvia e acaba desativando o
  // webhook se ele falhar muito — erro de um evento só é logado.
  for (const event of parseInstagramWebhook(body)) {
    try {
      if (event.kind === "message") {
        const clinicId = await handleMessage(event);
        if (clinicId) touchedClinics.add(clinicId);
      } else if (event.kind === "read") {
        await prisma.message.updateMany({
          where: { whatsappKeyId: event.mid, direction: "OUTBOUND" },
          data: { status: "READ", readAt: new Date() },
        });
      } else {
        await prisma.message.updateMany({ where: { whatsappKeyId: event.mid }, data: { deletedAt: new Date() } });
      }
    } catch (error) {
      await log({ event: JSON.parse(JSON.stringify(event)), error: error instanceof Error ? error.message : String(error) }, "FAILED");
    }
  }

  await Promise.all([...touchedClinics].map((id) => notifyInboxRealtime(id).catch(() => {})));
  return NextResponse.json({ ok: true });
}
