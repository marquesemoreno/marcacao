"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClinicRole, requireClinicPermission, requireClinicSession } from "@/lib/session";
import { can } from "@/lib/clinic-permissions";
import { brasiliaDayStart } from "@/lib/missed-call";

/** Chave da recuperação de ligação perdida (gestão) + o que aconteceu hoje. */
export async function getMissedCallSettings() {
  const { clinicId, userId } = await requireClinicSession();
  const today = brasiliaDayStart(new Date());
  const [clinic, role, sent, tasks] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { missedCallRecoveryEnabled: true } }),
    getClinicRole(userId),
    prisma.phoneCall.count({ where: { clinicId, recoveryStatus: "SENT", recoveredAt: { gte: today } } }),
    prisma.phoneCall.count({ where: { clinicId, recoveryStatus: "TASK", recoveredAt: { gte: today } } }),
  ]);
  return { canConfigure: can(role, "config"), enabled: clinic?.missedCallRecoveryEnabled ?? false, sentToday: sent, tasksToday: tasks };
}

export async function setMissedCallRecovery(enabled: boolean) {
  const { clinicId } = await requireClinicPermission("config");
  await prisma.clinic.update({ where: { id: clinicId }, data: { missedCallRecoveryEnabled: enabled === true } });
  revalidatePath("/clinic/tarefas");
  return { success: true as const };
}
