"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { resolveTvDisplay } from "@/lib/tv-call-server";
import {
  callQueueTicket,
  finishQueueTicket,
  followQueueTicket,
  issueQueueTicket,
  queueToday,
  type IssuedTicket,
  type QueueTicketView,
  type TicketFollow,
} from "@/lib/queue-ticket-server";
import type { TicketType } from "@/lib/queue-ticket";

// ── Totem (sem login, só o token do link do totem) ─────────────────────────────

async function totemClinic(token: string): Promise<string | null> {
  const d = await resolveTvDisplay(token);
  return d && d.kind === "TOTEM" ? d.clinicId : null;
}

export async function getTotemInfo(token: string): Promise<{ clinicName: string } | null> {
  const clinicId = await totemClinic(token);
  if (!clinicId) return null;
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true } });
  return { clinicName: clinic?.name ?? "" };
}

export async function takeTicket(token: string, input: { type: TicketType; identifier?: string | null }): Promise<{ ok: true; ticket: IssuedTicket } | { ok: false; error: string }> {
  const clinicId = await totemClinic(token);
  if (!clinicId) return { ok: false, error: "Totem desligado. Procure a recepção." };
  if (input.type !== "N" && input.type !== "P") return { ok: false, error: "Tipo de senha inválido." };
  try {
    return { ok: true, ticket: await issueQueueTicket(clinicId, { type: input.type, identifier: input.identifier?.slice(0, 20) }) };
  } catch (e) {
    console.error("[totem] falha ao gerar senha", e);
    return { ok: false, error: "Não deu pra gerar a senha. Tente de novo ou procure a recepção." };
  }
}

// ── Página do QR Code (sem login) ──────────────────────────────────────────────

export async function getTicketFollow(token: string): Promise<TicketFollow | null> {
  return followQueueTicket(token);
}

// ── Recepção / médico (permissão "chamar") ─────────────────────────────────────

export async function getQueue(): Promise<QueueTicketView[]> {
  const { clinicId } = await requireClinicPermission("chamar");
  return queueToday(clinicId);
}

/** Chama a próxima senha (preferencial primeiro) ou uma senha específica. null = fila vazia. */
export async function callTicket(input: { ticketId?: string | null; room: string }): Promise<{ code: string } | null> {
  const { clinicId, userId } = await requireClinicPermission("chamar");
  const res = await callQueueTicket(clinicId, userId, input);
  return res ? { code: res.code } : null;
}

export async function setTicketStatus(id: string, status: "DONE" | "NO_SHOW" | "CANCELLED" | "WAITING") {
  const { clinicId } = await requireClinicPermission("chamar");
  if (!["DONE", "NO_SHOW", "CANCELLED", "WAITING"].includes(status)) throw new Error("Status inválido.");
  await finishQueueTicket(clinicId, id, status);
  return { success: true as const };
}
