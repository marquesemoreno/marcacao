"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { normalizeLossReasonLabel, resolveLossReasons } from "@/lib/loss-reasons";

/** Motivos de perda da clínica da sessão: padrões + os que ela cadastrou. */
export async function listLossReasons() {
  const { clinicId } = await requireClinicSession();
  const custom = await prisma.lossReason.findMany({ where: { clinicId }, orderBy: { createdAt: "asc" }, select: { label: true } });
  return resolveLossReasons(custom.map((c) => c.label));
}

export async function addLossReason(rawLabel: string) {
  const { clinicId } = await requireClinicSession();
  const label = normalizeLossReasonLabel(rawLabel);
  if (!label) throw new Error("Escreva o motivo.");
  // O resultado passa pelo mesmo filtro da lista: um motivo que repete um padrão (ou outro
  // da clínica) não é gravado.
  const existing = await prisma.lossReason.findMany({ where: { clinicId }, select: { label: true } });
  const before = resolveLossReasons(existing.map((e) => e.label)).length;
  const after = resolveLossReasons([...existing.map((e) => e.label), label]).length;
  if (after === before) throw new Error("Esse motivo já existe.");
  await prisma.lossReason.create({ data: { clinicId, label } });
  return listLossReasons();
}

/** Só some da lista de escolha — conversas já finalizadas com esse motivo mantêm o rótulo. */
export async function removeLossReason(rawLabel: string) {
  const { clinicId } = await requireClinicSession();
  const label = normalizeLossReasonLabel(rawLabel);
  if (label) await prisma.lossReason.deleteMany({ where: { clinicId, label } });
  return listLossReasons();
}
