import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { verifyMetaSignature } from "@/lib/instagram-webhook";
import { parseCloudWebhook, type CloudEvent } from "@/lib/whatsapp-cloud-webhook";

/** Webhook único da API oficial do WhatsApp (app "chat" da TIVDC na Meta) pra TODAS as
 * clínicas: identifica a clínica pelo phone_number_id (WhatsappCloudAccount). Grava no
 * mesmo formato de Conversation/Message da Evolution, então o Chat não muda.
 * Env: WHATSAPP_CLOUD_VERIFY_TOKEN (escolhido por nós, informado no painel da Meta) e
 * META_APP_SECRET (assinatura do POST).
 * Entrega 1 da migração: grava recebidas, as enviadas pelo app do celular (coexistência)
 * e status. Automação do webhook da Evolution (IA, respostas a lembrete, tags…) entra
 * na entrega 3. */

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_CLOUD_VERIFY_TOKEN;
  if (expected && params.get("hub.mode") === "subscribe" && params.get("hub.verify_token") === expected) {
    return new Response(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("forbidden", { status: 403 });
}

const STATUS_MAP: Record<string, "SENT" | "DELIVERED" | "READ" | "FAILED"> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

async function conversationFor(clinicId: string, phone: string, name: string | undefined, at: Date) {
  const contact = await prisma.contact.upsert({
    where: { phone },
    update: {},
    create: { phone, name: name ?? phone },
  });
  const existing = await prisma.conversation.findFirst({ where: { clinicId, contactId: contact.id }, orderBy: { createdAt: "desc" } });
  if (existing) return existing;
  return prisma.conversation.create({ data: { clinicId, contactId: contact.id, status: "OPEN", lastMessageAt: at } });
}

async function handle(event: CloudEvent, clinicId: string) {
  if (event.kind === "status") {
    const status = STATUS_MAP[event.status];
    if (status) await prisma.message.updateMany({ where: { whatsappKeyId: event.keyId }, data: { status } });
    return;
  }
  if (await prisma.message.findUnique({ where: { whatsappKeyId: event.keyId }, select: { id: true } })) return;

  const inbound = event.kind === "inbound";
  const conversation = await conversationFor(clinicId, inbound ? event.from : event.to, inbound ? event.name : undefined, event.at);
  await prisma.message.create({
    data: {
      conversationId: conversation.id,
      direction: inbound ? "INBOUND" : "OUTBOUND",
      content: event.text,
      status: inbound ? "DELIVERED" : "SENT",
      whatsappKeyId: event.keyId,
      sentFromDevice: !inbound,
      createdAt: event.at,
    },
  });
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: event.at, ...(inbound ? { status: "OPEN" } : {}) },
  });
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!verifyMetaSignature(raw, request.headers.get("x-hub-signature-256"), process.env.META_APP_SECRET)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const events = parseCloudWebhook(body);
  const accounts = await prisma.whatsappCloudAccount.findMany({
    where: { phoneNumberId: { in: [...new Set(events.map((e) => e.phoneNumberId))] } },
    select: { phoneNumberId: true, clinicId: true },
  });
  const clinicByPhone = new Map(accounts.map((a) => [a.phoneNumberId, a.clinicId]));
  const touched = new Set<string>();
  for (const event of events) {
    const clinicId = clinicByPhone.get(event.phoneNumberId);
    if (!clinicId) continue;
    try {
      await handle(event, clinicId);
      touched.add(clinicId);
    } catch (error) {
      console.error("Falha ao gravar evento da API oficial do WhatsApp:", error);
    }
  }
  for (const clinicId of touched) notifyInboxRealtime(clinicId).catch(() => {});

  await prisma.webhookLog
    .create({ data: { event: "whatsapp_cloud.inbound", payload: body as Prisma.InputJsonValue, status: events.length ? "SUCCESS" : "IGNORED", responseCode: null } })
    .catch(() => {});
  // A Meta reenvia se não receber 200 rápido — sempre 200 depois de validar a assinatura.
  return NextResponse.json({ ok: true, events: events.length });
}
