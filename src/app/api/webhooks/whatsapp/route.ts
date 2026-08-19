import { NextResponse } from "next/server";
import type { AppointmentStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notifyAppointmentStatus, whatsappService } from "@/lib/whatsapp";

type IncomingMessage = { phone: string; text: string; name?: string };

/**
 * Cada provedor entrega o webhook de mensagem recebida num formato diferente.
 * Tenta primeiro o formato simples ({ phone, text, name? } — útil pra testar
 * com curl e é o que UAZAPI/Z-API mandam com pouca adaptação), depois o
 * formato de evento da Evolution API (messages.upsert).
 */
function extractIncomingMessage(body: unknown): IncomingMessage | null {
  if (!body || typeof body !== "object") return null;
  const payload = body as Record<string, unknown>;

  if (typeof payload.phone === "string" && typeof payload.text === "string") {
    return {
      phone: payload.phone,
      text: payload.text,
      name: typeof payload.name === "string" ? payload.name : undefined,
    };
  }

  const data = payload.data as Record<string, unknown> | undefined;
  const key = data?.key as Record<string, unknown> | undefined;
  const remoteJid = key?.remoteJid;
  const message = data?.message as Record<string, unknown> | undefined;
  const extended = message?.extendedTextMessage as Record<string, unknown> | undefined;
  const text = message?.conversation ?? extended?.text;
  const pushName = data?.pushName;

  if (typeof remoteJid === "string" && typeof text === "string") {
    return {
      phone: remoteJid.split("@")[0],
      text,
      name: typeof pushName === "string" ? pushName : undefined,
    };
  }

  return null;
}

function resolveStatusFromReply(text: string): AppointmentStatus | null {
  const normalized = text.trim().toUpperCase();
  if (normalized === "1" || normalized === "SIM") return "CONFIRMED";
  if (normalized === "2" || normalized === "CANCELAR") return "CANCELLED";
  return null;
}

async function logInbound(payload: Prisma.InputJsonValue, status: string) {
  await prisma.webhookLog.create({
    data: {
      event: "whatsapp.inbound",
      payload,
      status,
      responseCode: null,
    },
  });
}

/**
 * Garante um Contact para o telefone, e uma Conversation aberta pra ele.
 *
 * A clínica da conversa é resolvida em duas etapas: (1) reaproveita a
 * clínica de uma conversa já existente com esse contato, se houver; (2)
 * senão, usa a mesma heurística já empregada para confirmação de presença
 * — o agendamento mais recente (PENDING/CONFIRMED) para esse telefone.
 * Sem conversa prévia nem agendamento, não dá pra saber a clínica dona —
 * a mensagem só fica registrada em WebhookLog (ver limitação documentada
 * em docs/obsidian/05 - Módulo de Atendimento e Chat Realtime.md: hoje o
 * WhatsApp é um número único por plataforma, não um por clínica).
 */
async function findOrCreateConversation(phone: string, name: string | undefined) {
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneSuffix = phoneDigits.slice(-11);

  const contact = await prisma.contact.upsert({
    where: { phone: phoneSuffix },
    update: name ? { name } : {},
    create: { phone: phoneSuffix, name: name ?? phoneSuffix },
  });

  const existingConversation = await prisma.conversation.findFirst({
    where: { contactId: contact.id },
    orderBy: { createdAt: "desc" },
  });
  if (existingConversation) {
    return { contact, conversation: existingConversation };
  }

  const appointment = await prisma.appointment.findFirst({
    where: {
      patientPhone: { endsWith: phoneSuffix },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    select: { clinicProcedure: { select: { clinicId: true } } },
  });
  if (!appointment) {
    return { contact, conversation: null };
  }

  const conversation = await prisma.conversation.create({
    data: {
      clinicId: appointment.clinicProcedure.clinicId,
      contactId: contact.id,
      status: "OPEN",
      lastMessageAt: new Date(),
    },
  });
  return { contact, conversation };
}

export async function POST(request: Request) {
  const requiredSecret = process.env.WHATSAPP_WEBHOOK_SECRET;
  if (requiredSecret) {
    const providedSecret = request.headers.get("x-webhook-token");
    if (providedSecret !== requiredSecret) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const incoming = extractIncomingMessage(body);
  if (!incoming) {
    await logInbound(body, "IGNORED");
    return NextResponse.json({ ok: true });
  }

  const { conversation } = await findOrCreateConversation(incoming.phone, incoming.name);

  if (conversation) {
    await prisma.message.create({
      data: {
        conversationId: conversation.id,
        direction: "INBOUND",
        content: incoming.text,
        status: "DELIVERED",
      },
    });
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: new Date(), status: conversation.status === "RESOLVED" ? "OPEN" : conversation.status },
    });

    const activeAutomations = await prisma.chatAutomation.findMany({
      where: { active: true },
    });
    const textLower = incoming.text.toLowerCase();
    const matchedAutomation = activeAutomations.find((auto) =>
      textLower.includes(auto.keyword.toLowerCase())
    );

    if (matchedAutomation) {
      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          direction: "OUTBOUND",
          content: matchedAutomation.responseText,
          status: "DELIVERED",
        },
      });
      whatsappService.sendMessage(incoming.phone, matchedAutomation.responseText, "chat_automation.triggered").catch(() => {});
    }
  }

  const newStatus = resolveStatusFromReply(incoming.text);
  if (!newStatus) {
    await logInbound(
      {
        phone: incoming.phone,
        text: incoming.text,
        conversationId: conversation?.id ?? null,
        reason: conversation ? "mensagem de chat" : "sem clínica resolvida — só logado",
      },
      conversation ? "SUCCESS" : "IGNORED"
    );
    return NextResponse.json({ ok: true });
  }

  // O número recebido pode vir com DDI (55) ou formatação diferente do que
  // guardamos (só DDD+número); casamos pelos últimos 11 dígitos.
  const phoneDigits = incoming.phone.replace(/\D/g, "");
  const phoneSuffix = phoneDigits.slice(-11);

  const appointment = await prisma.appointment.findFirst({
    where: {
      patientPhone: { endsWith: phoneSuffix },
      status: { in: ["PENDING", "CONFIRMED"] },
    },
    orderBy: { createdAt: "desc" },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  if (!appointment) {
    await logInbound(
      { phone: incoming.phone, text: incoming.text, reason: "nenhum agendamento ativo encontrado" },
      "FAILED"
    );
    return NextResponse.json({ ok: true });
  }

  const updated = await prisma.appointment.update({
    where: { id: appointment.id },
    data: { status: newStatus },
    include: { clinicProcedure: { include: { clinic: true, procedure: true } } },
  });

  await logInbound(
    { phone: incoming.phone, text: incoming.text, appointmentId: appointment.id, newStatus },
    "SUCCESS"
  );

  notifyAppointmentStatus(newStatus, updated).catch((error) => {
    console.error("Falha ao notificar resposta via WhatsApp:", error);
  });

  return NextResponse.json({ ok: true });
}
