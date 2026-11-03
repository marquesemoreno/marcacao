"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { resolveTvDisplay } from "@/lib/tv-call-server";
import {
  callQueueTicket,
  finishQueueTicket,
  followQueueTicket,
  issueQueueTicket,
  listQueueServices,
  queueToday,
  type QueueServiceView,
  type IssuedTicket,
  type QueueTicketView,
  type TicketFollow,
} from "@/lib/queue-ticket-server";
import { normalizeServiceInput, type TicketType } from "@/lib/queue-ticket";
import { isInsideFence } from "@/lib/geo-fence";
import { requireClinicManager } from "@/lib/session";

// ── Totem (sem login, só o token do link do totem) ─────────────────────────────

/** TOTEM = aparelho na recepção; QR = cartaz lido pelo celular do paciente (exige estar na
 * clínica quando a gestão salvou o ponto da clínica). */
async function totemOf(token: string, kind: "TOTEM" | "QR"): Promise<string | null> {
  const d = await resolveTvDisplay(token);
  return d && d.kind === kind ? d.clinicId : null;
}

export async function getTotemInfo(token: string, kind: "TOTEM" | "QR" = "TOTEM"): Promise<{ clinicName: string; needsLocation: boolean; services: QueueServiceView[] } | null> {
  const clinicId = await totemOf(token, kind);
  if (!clinicId) return null;
  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { name: true, arrivalLat: true, arrivalLng: true } });
  return {
    clinicName: clinic?.name ?? "",
    needsLocation: kind === "QR" && clinic?.arrivalLat != null && clinic?.arrivalLng != null,
    services: await listQueueServices(clinicId, true),
  };
}

export async function takeTicket(
  token: string,
  input: { type: TicketType; identifier?: string | null; serviceId?: string | null; kind?: "TOTEM" | "QR"; location?: { lat: number; lng: number; accuracy: number } | null },
): Promise<{ ok: true; ticket: IssuedTicket } | { ok: false; error: string }> {
  const kind = input.kind === "QR" ? "QR" : "TOTEM";
  const clinicId = await totemOf(token, kind);
  if (!clinicId) return { ok: false, error: kind === "QR" ? "Este QR Code foi desligado. Retire a senha no balcão." : "Totem desligado. Procure a recepção." };
  if (input.type !== "N" && input.type !== "P") return { ok: false, error: "Tipo de senha inválido." };
  if (kind === "QR") {
    const c = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { arrivalLat: true, arrivalLng: true, arrivalRadiusM: true } });
    if (c?.arrivalLat != null && c.arrivalLng != null) {
      if (!input.location) return { ok: false, error: "Precisamos da sua localização para confirmar que você está na clínica." };
      if (!isInsideFence({ lat: c.arrivalLat, lng: c.arrivalLng, radiusM: c.arrivalRadiusM }, input.location)) {
        return { ok: false, error: "Parece que você ainda não está na clínica. Quando chegar, tente de novo — ou retire a senha no balcão." };
      }
    }
  }
  try {
    return { ok: true, ticket: await issueQueueTicket(clinicId, { type: input.type, identifier: input.identifier?.slice(0, 20), serviceId: input.serviceId ?? null }) };
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
export async function callTicket(input: { ticketId?: string | null; room: string; serviceIds?: string[] | null }): Promise<{ code: string } | null> {
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

// ── Ponto da clínica (gestão, estando na clínica) ──────────────────────────────

export async function getArrivalFence() {
  const { clinicId } = await requireClinicManager();
  const c = await prisma.clinic.findUnique({ where: { id: clinicId }, select: { arrivalLat: true, arrivalLng: true, arrivalRadiusM: true } });
  return { lat: c?.arrivalLat ?? null, lng: c?.arrivalLng ?? null, radiusM: c?.arrivalRadiusM ?? 150 };
}

export async function saveArrivalFence(input: { lat: number | null; lng: number | null; radiusM: number }) {
  const { clinicId } = await requireClinicManager();
  const ok = input.lat === null || (Number.isFinite(input.lat) && Number.isFinite(input.lng) && Math.abs(input.lat) <= 90 && Math.abs(input.lng!) <= 180);
  if (!ok) throw new Error("Localização inválida.");
  const radiusM = Math.min(1000, Math.max(50, Math.round(input.radiusM || 150)));
  await prisma.clinic.update({ where: { id: clinicId }, data: { arrivalLat: input.lat, arrivalLng: input.lat === null ? null : input.lng, arrivalRadiusM: radiusM } });
  return getArrivalFence();
}

// ── Serviços das senhas ────────────────────────────────────────────────────────

/** Serviços ativos (filtro do guichê na tela Senhas). */
export async function getQueueServices(): Promise<QueueServiceView[]> {
  const { clinicId } = await requireClinicPermission("chamar");
  return listQueueServices(clinicId);
}

export async function listQueueServicesAdmin(): Promise<QueueServiceView[]> {
  const { clinicId } = await requireClinicManager();
  return listQueueServices(clinicId);
}

export async function addQueueService(input: { name: string; letter: string }): Promise<QueueServiceView[]> {
  const { clinicId } = await requireClinicManager();
  const v = normalizeServiceInput(input);
  if (!v.ok) throw new Error(v.error);
  const taken = await prisma.queueService.findFirst({ where: { clinicId, letter: v.value.letter } });
  if (taken) throw new Error(`A letra ${v.value.letter} já é de "${taken.name}".`);
  const count = await prisma.queueService.count({ where: { clinicId } });
  await prisma.queueService.create({ data: { clinicId, ...v.value, position: count } });
  return listQueueServices(clinicId);
}

export async function updateQueueService(id: string, patch: { active?: boolean; name?: string }): Promise<QueueServiceView[]> {
  const { clinicId } = await requireClinicManager();
  const name = patch.name?.trim().replace(/\s+/g, " ").slice(0, 30);
  if (patch.name !== undefined && !name) throw new Error("Informe o nome do serviço.");
  await prisma.queueService.updateMany({ where: { id, clinicId }, data: { ...(patch.active !== undefined ? { active: patch.active } : {}), ...(name ? { name } : {}) } });
  return listQueueServices(clinicId);
}
