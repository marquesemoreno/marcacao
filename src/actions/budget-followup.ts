"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit-server";
import { budgetFollowupDue, budgetFollowupMessage } from "@/lib/budget-followup";
import { sendMessage } from "@/actions/inbox";

const FOLLOWUP_ACTION = "budget.followup";

export type BudgetFollowupItem = {
  conversationId: string;
  name: string;
  value: number | null;
  daysSince: number;
  step: number;
  message: string;
};

/** Fila "Orçamentos a cobrar": conversas abertas em Orçamento com cobrança vencida. */
export async function listBudgetFollowups(): Promise<{ due: BudgetFollowupItem[]; waiting: number }> {
  const { clinicId } = await requireClinicSession();
  const conversations = await prisma.conversation.findMany({
    where: { clinicId, funnelStage: "ORCAMENTO", status: { not: "RESOLVED" }, archivedAt: null },
    select: {
      id: true,
      createdAt: true,
      estimatedValue: true,
      contact: { select: { name: true } },
    },
    take: 500,
  });
  if (conversations.length === 0) return { due: [], waiting: 0 };
  const ids = conversations.map((c) => c.id);

  const [changes, followups] = await Promise.all([
    prisma.conversationStageChange.findMany({
      where: { conversationId: { in: ids }, toStage: "ORCAMENTO" },
      select: { conversationId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.auditLog.findMany({
      where: { clinicId, action: FOLLOWUP_ACTION, entity: "Conversation", entityId: { in: ids } },
      select: { entityId: true, createdAt: true },
    }),
  ]);

  const sentAtOf = new Map<string, Date>();
  for (const ch of changes) if (!sentAtOf.has(ch.conversationId)) sentAtOf.set(ch.conversationId, ch.createdAt);

  const now = new Date();
  const due: BudgetFollowupItem[] = [];
  for (const c of conversations) {
    const sentAt = sentAtOf.get(c.id) ?? c.createdAt;
    const mine = followups.filter((f) => f.entityId === c.id && f.createdAt >= sentAt);
    const last = mine.reduce<Date | null>((a, f) => (!a || f.createdAt > a ? f.createdAt : a), null);
    const d = budgetFollowupDue({ sentAt, done: mine.length, lastFollowupAt: last, now });
    if (!d) continue;
    due.push({
      conversationId: c.id,
      name: c.contact.name,
      value: c.estimatedValue ? Number(c.estimatedValue) : null,
      daysSince: d.daysSince,
      step: d.step,
      message: budgetFollowupMessage(d.step, c.contact.name),
    });
  }
  due.sort((a, b) => (b.value ?? 0) - (a.value ?? 0) || b.daysSince - a.daysSince);
  return { due, waiting: conversations.length - due.length };
}

/** Envia a cobrança revisada pela recepção e registra a etapa. */
export async function sendBudgetFollowup(
  conversationId: string,
  step: number,
  content: string,
): Promise<{ ok: boolean; error?: string }> {
  const { clinicId, userId } = await requireClinicSession();
  const text = content.trim();
  if (!text) return { ok: false, error: "Mensagem vazia." };
  try {
    const msg = await sendMessage(conversationId, text);
    if (msg && "status" in msg && msg.status === "FAILED") {
      return { ok: false, error: "O WhatsApp não aceitou a mensagem. Confira o número do paciente." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Não foi possível enviar." };
  }
  await recordAudit({
    clinicId,
    userId,
    action: FOLLOWUP_ACTION,
    entity: "Conversation",
    entityId: conversationId,
    before: null,
    after: { step },
  });
  return { ok: true };
}

/** Pula a cobrança desta etapa sem enviar (ex.: já falou por telefone). */
export async function skipBudgetFollowup(conversationId: string, step: number): Promise<{ ok: boolean }> {
  const { clinicId, userId } = await requireClinicSession();
  const conv = await prisma.conversation.findFirst({ where: { id: conversationId, clinicId }, select: { id: true } });
  if (!conv) return { ok: false };
  await recordAudit({
    clinicId,
    userId,
    action: FOLLOWUP_ACTION,
    entity: "Conversation",
    entityId: conversationId,
    before: null,
    after: { step, skipped: true },
  });
  return { ok: true };
}
