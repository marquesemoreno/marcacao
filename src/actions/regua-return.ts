"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicPermission } from "@/lib/session";
import { periodWindow, type PeriodKey } from "@/lib/report-period";
import { computeReguaReturn, REGUA_RETURN_KINDS } from "@/lib/regua-return";

/** Relatório: o que a régua de retorno/reativação trouxe (envios do período). */
export async function getReguaReturnReport(period: PeriodKey = "30") {
  const { clinicId } = await requireClinicPermission("relatorios");
  const { since, until } = periodWindow(period, false);
  const rules = await prisma.automationRule.findMany({
    where: { clinicId, kind: { in: [...REGUA_RETURN_KINDS] } },
    select: { id: true, kind: true },
  });
  if (!rules.length) return null;
  const kindOf = new Map(rules.map((r) => [r.id, r.kind]));
  const recipients = await prisma.broadcastRecipient.findMany({
    where: {
      status: "SENT",
      sentAt: { gte: since, lt: until ?? new Date() },
      campaign: { clinicId, automationRuleId: { in: rules.map((r) => r.id) } },
    },
    select: { phone: true, sentAt: true, campaign: { select: { automationRuleId: true } } },
  });
  if (!recipients.length) return null;
  const sent = recipients.map((r) => ({ phone: r.phone, sentAt: r.sentAt!, kind: kindOf.get(r.campaign.automationRuleId!) ?? "" }));
  const firstSent = new Date(Math.min(...sent.map((s) => s.sentAt.getTime())));

  const phones = new Set<string>();
  for (const s of sent) {
    const p = s.phone.replace(/\D/g, "");
    phones.add(p);
    if (p.startsWith("55") && p.length === 12) phones.add(p.slice(0, 4) + "9" + p.slice(4));
    if (p.startsWith("55") && p.length === 13) phones.add(p.slice(0, 4) + p.slice(5));
  }
  const [contacts, clinic] = await Promise.all([
    prisma.contact.findMany({
      where: { phone: { in: [...phones] } },
      select: {
        phone: true,
        conversations: {
          where: { clinicId },
          select: {
            resolutionReason: true,
            resolvedAt: true,
            messages: { where: { direction: "INBOUND", createdAt: { gt: firstSent } }, select: { createdAt: true } },
            stageChanges: { where: { toStage: "AGENDADO", createdAt: { gt: firstSent } }, select: { createdAt: true } },
          },
        },
      },
    }),
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { defaultTicket: true } }),
  ]);
  const outcomes = contacts
    .filter((c) => c.phone)
    .map((c) => ({
      phone: c.phone as string,
      inboundAt: c.conversations.flatMap((cv) => cv.messages.map((m) => m.createdAt)),
      scheduledAt: c.conversations.flatMap((cv) => [
        ...cv.stageChanges.map((s) => s.createdAt),
        ...(cv.resolutionReason === "AGENDAMENTO_CONCLUIDO" && cv.resolvedAt ? [cv.resolvedAt] : []),
      ]),
    }));
  const ticket = clinic?.defaultTicket != null ? Number(clinic.defaultTicket) : null;
  return computeReguaReturn(sent, outcomes, ticket);
}
