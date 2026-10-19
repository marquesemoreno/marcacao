"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";
import { buildSlotOfferMessage, normalizeWaitlistInput, rankWaitlistCandidates, type OpenSlot } from "@/lib/waitlist";

const ENTRY_SELECT = { id: true, patientName: true, phone: true, doctorName: true, period: true, notes: true, status: true, createdAt: true } as const;

export type WaitlistRow = {
  id: string;
  patientName: string;
  phone: string;
  doctorName: string | null;
  period: string;
  notes: string | null;
  status: string;
  createdAt: string;
};

function toRow(e: { id: string; patientName: string; phone: string; doctorName: string | null; period: string; notes: string | null; status: string; createdAt: Date }): WaitlistRow {
  return { ...e, createdAt: e.createdAt.toISOString() };
}

/** Quem está esperando (aguardando ou já com oferta enviada), do mais antigo ao mais novo. */
export async function listWaitlist(): Promise<WaitlistRow[]> {
  const { clinicId } = await requireClinicSession();
  const entries = await prisma.waitlistEntry.findMany({
    where: { clinicId, status: { in: ["WAITING", "OFFERED"] } },
    orderBy: { createdAt: "asc" },
    select: ENTRY_SELECT,
  });
  return entries.map(toRow);
}

export async function addWaitlistEntry(input: {
  patientName: string;
  phone: string;
  doctorName?: string | null;
  period?: string | null;
  notes?: string | null;
}) {
  const { clinicId } = await requireClinicSession();
  const parsed = normalizeWaitlistInput(input);
  if (!parsed.ok) throw new Error(parsed.error);
  await prisma.waitlistEntry.create({ data: { clinicId, ...parsed.value } });
  revalidatePath("/clinic/agenda");
  return listWaitlist();
}

const NEXT_STATUSES = ["WAITING", "OFFERED", "BOOKED", "CANCELLED"] as const;

/** OFFERED = oferta enviada, BOOKED = encaixou, CANCELLED = saiu da lista, WAITING = volta
 * para a fila (ex.: o paciente recusou a vaga). */
export async function setWaitlistEntryStatus(id: string, status: (typeof NEXT_STATUSES)[number]) {
  const { clinicId } = await requireClinicSession();
  if (!NEXT_STATUSES.includes(status)) throw new Error("Status inválido.");
  const { count } = await prisma.waitlistEntry.updateMany({
    where: { id, clinicId },
    data: { status, offeredAt: status === "OFFERED" ? new Date() : status === "WAITING" ? null : undefined },
  });
  if (count === 0) throw new Error("Paciente não encontrado na lista.");
  revalidatePath("/clinic/agenda");
  return listWaitlist();
}

export type SlotCandidate = WaitlistRow & { message: string; whatsappUrl: string };

/** Candidatos da espera para uma vaga aberta, já com a oferta escrita e o link do WhatsApp
 * (a recepção revisa e envia pelo próprio WhatsApp — nada sai daqui). */
export async function getSlotCandidates(slot: OpenSlot, exceptPhone?: string | null): Promise<SlotCandidate[]> {
  const { clinicId } = await requireClinicSession();
  const [entries, clinic] = await Promise.all([
    prisma.waitlistEntry.findMany({ where: { clinicId, status: "WAITING" }, select: ENTRY_SELECT }),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { tradeName: true } }),
  ]);
  const clinicName = clinic?.tradeName ?? "nossa clínica";
  return rankWaitlistCandidates(entries, slot, { exceptPhone }).map((e) => {
    const message = buildSlotOfferMessage(slot, e.patientName, clinicName);
    return {
      ...toRow(e),
      message,
      whatsappUrl: `https://wa.me/${formatToWhatsAppNumber(e.phone)}?text=${encodeURIComponent(message)}`,
    };
  });
}
