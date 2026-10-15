import "server-only";
import { prisma } from "@/lib/prisma";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { isWithinMarketingWindow, MARKETING_DAILY_CAP, startOfBrazilDay } from "@/lib/broadcast-schedule";

/** Última mensagem automática da clínica — lembrete D-1, campanha ou aviso urgente de
 * remarcação (desde 15/10/2026 o aviso também respeita o intervalo). Base do intervalo
 * único de 4–6 min entre mensagens automáticas (ver automated-pacing.ts). */
export async function lastAutomatedSend(clinicId: string): Promise<{ at: Date | null; kind: "reminder" | "campaign" | null }> {
  const [reminder, campaign] = await Promise.all([
    prisma.bridgeReminderLog.findFirst({ where: { clinicId }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
    prisma.broadcastRecipient.findFirst({
      where: {
        status: "SENT",
        sentAt: { not: null },
        campaign: { clinicId },
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
  ]);
  const r = reminder?.sentAt ?? null;
  const c = campaign?.sentAt ?? null;
  if (!r && !c) return { at: null, kind: null };
  if (r && (!c || r >= c)) return { at: r, kind: "reminder" };
  return { at: c, kind: "campaign" };
}

/** Há campanha de marketing da clínica pronta pra mandar agora (horário, limite do dia e
 * gente na fila)? Usado pra decidir a vez na intercalação lembrete/campanha. */
export async function marketingCampaignReady(clinicId: string, now: Date): Promise<boolean> {
  if (!isWithinMarketingWindow(now)) return false;
  const campaigns = await prisma.broadcastCampaign.findMany({
    // Campanha de baixa prioridade não disputa a vez com os lembretes (eles vêm antes).
    where: { clinicId, status: "RUNNING", lowPriority: false, OR: [{ tagOnSend: null }, { tagOnSend: { not: RESCHEDULE_PENDING_TAG } }] },
    select: { id: true },
  });
  for (const c of campaigns) {
    const [pending, sentToday] = await Promise.all([
      prisma.broadcastRecipient.count({ where: { campaignId: c.id, status: "PENDING" } }),
      prisma.broadcastRecipient.count({ where: { campaignId: c.id, status: "SENT", sentAt: { gte: startOfBrazilDay(now) } } }),
    ]);
    if (pending > 0 && sentToday < MARKETING_DAILY_CAP) return true;
  }
  return false;
}
