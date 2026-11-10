import "server-only";
import { prisma } from "@/lib/prisma";
import { phoneTail } from "@/lib/marcadores";
import { ATTENDED_MARK_STATUSES, computeLeadOutcome } from "@/lib/ad-tracking";

/** Motivos de finalização que significam "agendou" (mesma lista do relatório de marcadores). */
export const SCHEDULED_REASONS = ["AGENDAMENTO_CONCLUIDO", "CONFIRMACAO_AGENDA", "AGENDAMENTO_REMARCADO"];

export type OutcomeConversation = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  funnelStage: string;
  resolutionReason: string | null;
  resolvedAt: Date | null;
  phone: string | null;
  /** Datas em que a conversa entrou na etapa "Agendado". */
  scheduledStageAt: Date[];
};

/** Agendou/compareceu de cada conversa de UMA clínica: etapa do CRM, finalização,
 * agendamento do Conecta, lembrete da agenda da clínica (ponte) e marcação de chegada na
 * Agenda — casados pelo telefone (8 últimos dígitos), só depois do início da conversa. */
export async function computeOutcomes(clinicId: string, convs: OutcomeConversation[]) {
  const result = new Map<string, { scheduledAt: Date | null; attendedAt: Date | null }>();
  if (convs.length === 0) return result;
  const since = convs.reduce((a, c) => (c.createdAt < a ? c.createdAt : a), convs[0].createdAt);
  const tails = [...new Set(convs.map((c) => (c.phone ? phoneTail(c.phone) : null)).filter((t): t is string => !!t))];

  const chunks: string[][] = [];
  for (let i = 0; i < tails.length; i += 200) chunks.push(tails.slice(i, i + 200));
  const appointments = [], reminders = [], marks = [];
  for (const chunk of chunks) {
    const [a, r, m] = await Promise.all([
      prisma.appointment.findMany({
        where: { clinicProcedure: { clinicId }, createdAt: { gte: since }, OR: chunk.map((t) => ({ patientPhone: { endsWith: t } })) },
        select: { patientPhone: true, status: true, createdAt: true, updatedAt: true },
      }),
      prisma.bridgeReminderLog.findMany({
        where: { clinicId, sentAt: { gte: since }, OR: chunk.map((t) => ({ phone: { endsWith: t } })) },
        select: { phone: true, sentAt: true },
      }),
      prisma.agendaMark.findMany({
        where: {
          clinicId,
          status: { in: ATTENDED_MARK_STATUSES },
          date: { gte: new Date(since.toISOString().slice(0, 10)) },
          OR: chunk.map((t) => ({ phone: { endsWith: t } })),
        },
        select: { phone: true, date: true, updatedAt: true },
      }),
    ]);
    appointments.push(...a);
    reminders.push(...r);
    marks.push(...m);
  }

  for (const c of convs) {
    const stage =
      c.scheduledStageAt.length > 0
        ? c.scheduledStageAt.reduce((a, d) => (d < a ? d : a))
        : c.funnelStage === "AGENDADO"
          ? c.updatedAt
          : c.resolutionReason && SCHEDULED_REASONS.includes(c.resolutionReason)
            ? (c.resolvedAt ?? c.updatedAt)
            : null;
    result.set(
      c.id,
      computeLeadOutcome({
        since: c.createdAt,
        phoneTail: c.phone ? phoneTail(c.phone) : null,
        stageScheduledAt: stage,
        appointments: appointments.map((a) => ({ ...a, status: a.status as string })),
        reminders,
        marks,
      }),
    );
  }
  return result;
}
