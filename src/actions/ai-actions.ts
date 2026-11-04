"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { URGENCY_TAG } from "@/lib/conversation-tags";
import { describeAiAction, filterAiActions, type AiActionGroup } from "@/lib/ai-actions";

export type AiActionRow = {
  id: string;
  conversationId: string;
  patientName: string;
  createdAt: string;
  label: string;
  group: AiActionGroup;
  tone: "positive" | "neutral" | "attention";
  detail: string;
};

/** Ações da IA dos últimos `days` dias da clínica da sessão, mais recentes primeiro. */
export async function listAiActions(days = 30, filter: { group?: AiActionGroup; query?: string } = {}): Promise<AiActionRow[]> {
  const { clinicId } = await requireClinicSession();
  const since = new Date(Date.now() - Math.min(Math.max(days, 1), 90) * 86_400_000);
  const logs = await prisma.aiActionLog.findMany({
    where: { clinicId, createdAt: { gte: since } },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
  const conversations = await prisma.conversation.findMany({
    where: { id: { in: [...new Set(logs.map((l) => l.conversationId))] }, clinicId },
    select: { id: true, contact: { select: { name: true } } },
  });
  const nameOf = new Map(conversations.map((c) => [c.id, c.contact.name]));
  const records = logs.map((l) => ({ ...l, patientName: nameOf.get(l.conversationId) ?? "Paciente" }));
  return filterAiActions(records, filter).map((r) => ({
    id: r.id,
    conversationId: r.conversationId,
    patientName: r.patientName,
    createdAt: r.createdAt.toISOString(),
    ...describeAiAction(r),
  }));
}

/** Etiqueta "🚨 Urgência Clínica" automática (sintoma grave): estado e quem pode mudar. */
export async function getUrgencyTagSetting() {
  const { clinicId, userId } = await requireClinicSession();
  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { urgencyTagEnabled: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isManager: true } }),
  ]);
  return { enabled: !!clinic?.urgencyTagEnabled, canToggle: !!user?.isManager };
}

/** Gestão liga/desliga. Desligar também tira a etiqueta das conversas desta clínica. */
export async function setUrgencyTagEnabled(enabled: boolean) {
  const { clinicId } = await requireClinicManager();
  await prisma.clinic.update({ where: { id: clinicId }, data: { urgencyTagEnabled: enabled } });
  if (!enabled) {
    await prisma.$executeRaw`UPDATE conversations SET tags = array_remove(tags, ${URGENCY_TAG}) WHERE clinic_id = ${clinicId} AND ${URGENCY_TAG} = ANY(tags)`;
  }
  return getUrgencyTagSetting();
}
