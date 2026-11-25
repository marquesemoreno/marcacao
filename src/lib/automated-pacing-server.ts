import "server-only";
import { prisma } from "@/lib/prisma";
import { RESCHEDULE_PENDING_TAG } from "@/lib/conversation-tags";
import { cloudDailyCap, isWithinMarketingWindow, MARKETING_DAILY_CAP, startOfBrazilDay } from "@/lib/broadcast-schedule";
import { activeCloudAccount } from "@/lib/whatsapp-cloud-send";
import { getMessagingLimit } from "@/lib/whatsapp-cloud";

/** Última mensagem automática da clínica — lembrete D-1, campanha ou aviso urgente de
 * remarcação (desde 15/10/2026 o aviso também respeita o intervalo). Base do intervalo
 * único de 4–6 min entre mensagens automáticas (ver automated-pacing.ts). */
export async function lastAutomatedSend(clinicId: string): Promise<{ at: Date | null; kind: "reminder" | "campaign" | null }> {
  const [reminder, secondReminder, campaign, failed] = await Promise.all([
    prisma.bridgeReminderLog.findFirst({ where: { clinicId }, orderBy: { sentAt: "desc" }, select: { sentAt: true } }),
    // 2º lembrete do dia (second-reminder.ts) fica na mesma linha, em secondSentAt.
    prisma.bridgeReminderLog.findFirst({
      where: { clinicId, secondSentAt: { not: null } },
      orderBy: { secondSentAt: "desc" },
      select: { secondSentAt: true },
    }),
    prisma.broadcastRecipient.findFirst({
      where: {
        status: "SENT",
        sentAt: { not: null },
        // SMS e e-mail não contam: o intervalo único existe por causa do risco de bloqueio do
        // número de WhatsApp.
        // Modelo da API oficial também não (25/11/2026): o lote por minuto da campanha
        // travaria os lembretes do número não oficial para sempre.
        campaign: { clinicId, channel: "WHATSAPP", cloudTemplateName: null },
      },
      orderBy: { sentAt: "desc" },
      select: { sentAt: true },
    }),
    // Tentativa automática que FALHOU também conta pro intervalo — antes só o sucesso
    // contava, e com o número bloqueado (Urolaser, 15/10) o lembrete era reenviado a
    // cada minuto.
    prisma.message.findFirst({
      where: { status: "FAILED", direction: "OUTBOUND", senderUserId: null, sentFromDevice: false, conversation: { clinicId } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);
  const f = failed?.createdAt ?? null;
  const d1 = reminder?.sentAt ?? null;
  const s2 = secondReminder?.secondSentAt ?? null;
  const r0 = s2 && (!d1 || s2 > d1) ? s2 : d1;
  const r = f && (!r0 || f > r0) ? f : r0;
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
    // Campanha pela API oficial (modelo) tem ritmo próprio e não disputa a vez com os lembretes.
    where: { clinicId, channel: "WHATSAPP", status: "RUNNING", lowPriority: false, cloudTemplateName: null, OR: [{ tagOnSend: null }, { tagOnSend: { not: RESCHEDULE_PENDING_TAG } }] },
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

/** Enviadas pela API oficial (campanhas com modelo) na clínica toda nas ÚLTIMAS 24 h — o
 * nível de mensagens da Meta é por número e em janela corrida de 24 h, não por dia. */
export async function cloudSentToday(clinicId: string, now: Date): Promise<number> {
  return prisma.broadcastRecipient.count({
    where: { status: "SENT", sentAt: { gte: new Date(now.getTime() - 86_400_000) }, campaign: { clinicId, channel: "WHATSAPP", cloudTemplateName: { not: null } } },
  });
}

const tierCache = new Map<string, { tier: string | null; at: number }>();
/** Teto de campanhas da clínica pelo nível da Meta (cache de 10 min; falha = último conhecido
 * ou o menor nível). Sem conta da API oficial: o menor nível. */
export async function cloudCapForClinic(clinicId: string): Promise<number> {
  const cached = tierCache.get(clinicId);
  if (cached && Date.now() - cached.at < 10 * 60_000) return cloudDailyCap(cached.tier);
  const account = await activeCloudAccount(clinicId);
  let tier: string | null = cached?.tier ?? null;
  if (account) {
    const r = await getMessagingLimit(account.phoneNumberId, account.token);
    if (r.success) tier = r.data.messaging_limit_tier ?? null;
  }
  tierCache.set(clinicId, { tier, at: Date.now() });
  return cloudDailyCap(tier);
}
