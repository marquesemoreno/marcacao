"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { recordAudit } from "@/lib/audit-server";
import { budgetFollowupDue, budgetFollowupMessage } from "@/lib/budget-followup";
import { sendMessage } from "@/actions/inbox";
import { computeBudgetConversion, type BudgetConversion, type BudgetRow } from "@/lib/budget-conversion";
import { periodWindow, type PeriodKey } from "@/lib/report-period";
import { requireClinicPermission } from "@/lib/session";

const FOLLOWUP_ACTION = "budget.followup";

/** Relatório: orçamentos que entraram no período e o que aconteceu com eles. */
export async function getBudgetConversionReport(period: PeriodKey = "30"): Promise<BudgetConversion> {
  const { clinicId } = await requireClinicPermission("relatorios");
  const { since, until } = periodWindow(period, false);
  const entries = await prisma.conversationStageChange.findMany({
    where: {
      toStage: "ORCAMENTO",
      createdAt: { gte: since, lt: until ?? new Date() },
      conversation: { clinicId },
    },
    orderBy: { createdAt: "asc" },
    select: {
      conversationId: true,
      createdAt: true,
      conversation: { select: { status: true, resolutionReason: true, estimatedValue: true } },
    },
  });
  const first = new Map<string, (typeof entries)[number]>();
  for (const e of entries) if (!first.has(e.conversationId)) first.set(e.conversationId, e);
  const ids = [...first.keys()];
  if (ids.length === 0) return computeBudgetConversion([]);

  const [scheduledChanges, followups] = await Promise.all([
    prisma.conversationStageChange.findMany({
      where: { conversationId: { in: ids }, toStage: "AGENDADO" },
      select: { conversationId: true, createdAt: true },
    }),
    prisma.auditLog.findMany({
      where: { clinicId, action: FOLLOWUP_ACTION, entity: "Conversation", entityId: { in: ids } },
      select: { entityId: true, createdAt: true, changes: true },
    }),
  ]);

  const rows: BudgetRow[] = [...first.values()].map((e) => ({
    value: e.conversation.estimatedValue ? Number(e.conversation.estimatedValue) : null,
    scheduled: scheduledChanges.some((s) => s.conversationId === e.conversationId && s.createdAt > e.createdAt),
    status: e.conversation.status,
    resolutionReason: e.conversation.resolutionReason,
    followups: followups.filter(
      (f) => f.entityId === e.conversationId && f.createdAt >= e.createdAt && !JSON.stringify(f.changes).includes("skipped"),
    ).length,
  }));
  return computeBudgetConversion(rows);
}

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
