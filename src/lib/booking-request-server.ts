import "server-only";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { BOOKING_EXTRACTION_PROMPT, bookingRequestAction, parseBookingExtraction } from "@/lib/booking-request";
import { notifyAgenda } from "@/lib/realtime-server";

let client: OpenAI | null = null;
function openai(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/** Depois que o Jev disse "Quer agendar": a IA lê as últimas mensagens do paciente e cria
 * (ou atualiza) o pedido de marcação da recepção. Nunca lança; sem OpenAI não faz nada. */
export async function upsertBookingRequestFromConversation(conversationId: string): Promise<void> {
  try {
    const ai = openai();
    if (!ai) return;
    const conversation = await prisma.conversation.findUnique({
      where: { id: conversationId },
      select: { clinicId: true, contact: { select: { phone: true, name: true } } },
    });
    if (!conversation?.clinicId) return;
    const recent = await prisma.message.findMany({
      where: { conversationId, direction: "INBOUND", type: "TEXT", deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { content: true },
    });
    if (recent.length === 0) return;
    const completion = await ai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: BOOKING_EXTRACTION_PROMPT },
        { role: "user", content: recent.reverse().map((m) => m.content.slice(0, 500)).join("\n") },
      ],
      response_format: { type: "json_object" },
      max_tokens: 250,
      temperature: 0,
    });
    const raw = completion.choices[0]?.message?.content;
    const data = parseBookingExtraction(raw ? JSON.parse(raw) : null);
    if (!data) return;
    const last = await prisma.bookingRequest.findFirst({
      where: { conversationId },
      orderBy: { createdAt: "desc" },
      select: { id: true, status: true, createdAt: true },
    });
    const fields = { ...data, patientName: data.patientName ?? conversation.contact?.name ?? null };
    if (bookingRequestAction(last, new Date()) === "UPDATE" && last) {
      // Atualiza só o que veio preenchido (a conversa vai completando o pedido).
      const patch = Object.fromEntries(Object.entries(fields).filter(([k, v]) => v !== null && !(k === "period" && v === "ANY")));
      await prisma.bookingRequest.update({ where: { id: last.id }, data: patch });
    } else {
      await prisma.bookingRequest.create({
        data: { clinicId: conversation.clinicId, conversationId, phone: conversation.contact?.phone ?? null, ...fields },
      });
    }
    await notifyAgenda(conversation.clinicId);
  } catch (error) {
    console.error("[pré-agendamento] falha ao extrair pedido:", error);
  }
}
