"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { parseInsuranceList } from "@/lib/insurance-reply";

export type InsuranceSettingsView = { enabled: boolean; accepted: string[]; note: string; canEdit: boolean };

const NOTE_MAX = 300;

/** Convênios aceitos + resposta automática (roteiro 2.7) — página Ações da IA. */
export async function getInsuranceSettings(): Promise<InsuranceSettingsView> {
  const { clinicId, userId } = await requireClinicSession();
  const [settings, user] = await Promise.all([
    prisma.clinicInsuranceSettings.findUnique({ where: { clinicId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isManager: true } }),
  ]);
  return { enabled: !!settings?.enabled, accepted: settings?.accepted ?? [], note: settings?.note ?? "", canEdit: !!user?.isManager };
}

export async function setInsuranceSettings(input: { enabled: boolean; acceptedText: string; note: string }): Promise<InsuranceSettingsView> {
  const { clinicId } = await requireClinicManager();
  const accepted = parseInsuranceList(input.acceptedText);
  if (input.enabled && accepted.length === 0) throw new Error("Cadastre pelo menos um convênio antes de ligar.");
  const data = { enabled: input.enabled, accepted, note: input.note.trim().slice(0, NOTE_MAX) || null };
  await prisma.clinicInsuranceSettings.upsert({ where: { clinicId }, create: { clinicId, ...data }, update: data });
  return getInsuranceSettings();
}
