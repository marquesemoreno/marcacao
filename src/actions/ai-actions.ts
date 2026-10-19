"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
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
