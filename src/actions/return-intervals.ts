"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { fetchBridgeDoctors } from "@/lib/hospital-bridge";
import { resolveReturnDays, returnDueDate, validateReturnDays, type ReturnInterval } from "@/lib/return-interval";

const DEFAULT_DAYS = 180;

async function defaultDays(clinicId: string) {
  const rule = await prisma.automationRule.findUnique({ where: { clinicId_kind: { clinicId, kind: "RETORNO" } }, select: { daysAfter: true } });
  return rule?.daysAfter ?? DEFAULT_DAYS;
}

async function intervalsOf(clinicId: string): Promise<ReturnInterval[]> {
  return (await prisma.returnInterval.findMany({ where: { clinicId } }).catch(() => [])) as ReturnInterval[];
}

/** Tela de configuração (gestão): médicos do sistema da clínica + procedimentos do Conecta. */
export async function getReturnIntervalSettings() {
  const { clinicId } = await requireClinicManager();
  const [saved, doctors, procedures, fallback] = await Promise.all([
    intervalsOf(clinicId),
    fetchBridgeDoctors(clinicId).catch(() => []),
    prisma.clinicProcedure.findMany({ where: { clinicId }, select: { id: true, procedure: { select: { name: true } } } }),
    defaultDays(clinicId),
  ]);
  const daysOf = (kind: ReturnInterval["kind"], key: string) => saved.find((s) => s.kind === kind && s.key === key)?.days ?? null;
  return {
    fallback,
    doctors: doctors
      .map((d) => ({ key: String(d.id).trim(), label: d.nome, days: daysOf("DOCTOR", String(d.id).trim()) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    procedures: procedures
      .map((p) => ({ key: p.id, label: p.procedure.name, days: daysOf("PROCEDURE", p.id) }))
      .sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
  };
}

/** days null = volta ao padrão (apaga). */
export async function saveReturnInterval(input: { kind: "DOCTOR" | "PROCEDURE"; key: string; label: string; days: number | null }) {
  const { clinicId } = await requireClinicManager();
  if (input.kind !== "DOCTOR" && input.kind !== "PROCEDURE") throw new Error("Tipo inválido.");
  const key = input.key.trim().slice(0, 100);
  if (!key) throw new Error("Item inválido.");
  if (input.kind === "PROCEDURE") {
    const ok = await prisma.clinicProcedure.findFirst({ where: { id: key, clinicId }, select: { id: true } });
    if (!ok) throw new Error("Procedimento não encontrado.");
  }
  if (input.days === null) {
    await prisma.returnInterval.deleteMany({ where: { clinicId, kind: input.kind, key } });
  } else {
    const invalid = validateReturnDays(input.days);
    if (invalid) throw new Error(invalid);
    const label = input.label.trim().slice(0, 120) || key;
    await prisma.returnInterval.upsert({
      where: { clinicId_kind_key: { clinicId, kind: input.kind, key } },
      create: { clinicId, kind: input.kind, key, label, days: input.days },
      update: { label, days: input.days },
    });
  }
  revalidatePath("/clinic/retorno");
  return { success: true as const };
}

/** Painel do paciente na Agenda: "Retorno sugerido". Procedimento (Conecta) > médico > padrão. */
export async function getAgendaReturnHint(input: { source: "BRIDGE" | "LOCAL"; externalId: string; date: string; doctor: string | null }) {
  const { clinicId } = await requireClinicSession();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return null;
  const procedureId =
    input.source === "LOCAL"
      ? (await prisma.appointment.findFirst({ where: { id: input.externalId, clinicProcedure: { clinicId } }, select: { clinicProcedureId: true } }))?.clinicProcedureId ?? null
      : null;
  const [intervals, fallback] = await Promise.all([intervalsOf(clinicId), defaultDays(clinicId)]);
  const configured = resolveReturnDays({ procedureId, doctorName: input.doctor }, intervals, -1);
  const days = configured === -1 ? fallback : configured;
  return { days, due: returnDueDate(input.date, days), isDefault: configured === -1 };
}
