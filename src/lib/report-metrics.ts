/** Agregações puras do /clinic/relatorio (seções de equipe, confirmações, médicos,
 * tipo de atendimento e horário de pico) — separadas das queries em
 * src/actions/clinic.ts pra dar pra testar sem banco. */
import { toTitleCaseName } from "./format";
import { customLossReasonLabel } from "./loss-reasons";
import { computeBusinessMinutesElapsed, SLA_WARNING_MINUTES } from "./sla-calculator";
import type { BusinessHours } from "./schemas/clinic";

const pct = (part: number, total: number) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

export type AttendantConversation = {
  userId: string | null;
  userName: string | null;
  status: string;
  resolutionReason: string | null;
  firstResponseSec: number | null;
};

export type AttendantRow = {
  userId: string;
  userName: string;
  total: number;
  /** Conversas com desfecho (base da conversão — ver outcomeBase). */
  withOutcome: number;
  scheduled: number;
  conversionRate: number | null;
  medianFrtSec: number | null;
};

/** Finalizações automáticas que não dizem nada sobre o atendimento: o paciente sumiu
 * (auto-close por inatividade, "sem resposta"). Ficam FORA da base da conversão — sem
 * isso, cada conversa fechada pelo auto-close de 4h úteis derrubava a conversão sem
 * nenhuma mudança real (crítica de Relatórios, 15/10). */
export const NO_OUTCOME_REASONS = new Set(["INATIVIDADE", "SEM_RESPOSTA"]);

/** Conversa entra na base da conversão: resolvida e com desfecho de verdade. */
export function hasOutcome(c: { status: string; resolutionReason: string | null }) {
  return c.status === "RESOLVED" && !NO_OUTCOME_REASONS.has(c.resolutionReason ?? "");
}

/** Volume mínimo de conversas com desfecho pra uma atendente concorrer ao selo "Maior
 * conversão" — 1 de 1 (100%) não pode ganhar de 30 de 50. */
export const MIN_ATTENDANT_VOLUME = 5;

/** Conversão = agendamentos / conversas COM DESFECHO da atendente (mesma base do card
 * "Conversão em agendamento"). Tempo de 1ª resposta em MEDIANA, como o resto da página
 * (média deixava uma conversa esquecida puxar tudo). Conversas sem atendente ficam de fora. */
export function computeAttendantPerformance(conversations: AttendantConversation[]): AttendantRow[] {
  const byUser = new Map<string, { name: string; total: number; withOutcome: number; scheduled: number; frt: number[] }>();
  for (const c of conversations) {
    if (!c.userId) continue;
    const entry = byUser.get(c.userId) ?? { name: c.userName ?? "—", total: 0, withOutcome: 0, scheduled: 0, frt: [] };
    entry.total++;
    if (hasOutcome(c)) entry.withOutcome++;
    if (c.resolutionReason === "AGENDAMENTO_CONCLUIDO") entry.scheduled++;
    if (c.firstResponseSec !== null) entry.frt.push(c.firstResponseSec);
    byUser.set(c.userId, entry);
  }
  return [...byUser.entries()]
    .map(([userId, e]) => ({
      userId,
      userName: e.name,
      total: e.total,
      withOutcome: e.withOutcome,
      scheduled: e.scheduled,
      conversionRate: e.withOutcome > 0 ? pct(e.scheduled, e.withOutcome) : null,
      medianFrtSec: median(e.frt),
    }))
    .sort((a, b) => (b.conversionRate ?? -1) - (a.conversionRate ?? -1) || b.total - a.total);
}

/** Atendente com maior conversão entre as que têm volume mínimo (e ao menos 1 agendamento). */
export function topConverter(rows: AttendantRow[]): string | null {
  const eligible = rows.filter((r) => r.withOutcome >= MIN_ATTENDANT_VOLUME && r.scheduled > 0);
  eligible.sort((a, b) => (b.conversionRate ?? 0) - (a.conversionRate ?? 0) || b.withOutcome - a.withOutcome);
  return eligible[0]?.userId ?? null;
}

export type OutcomeGroup = "agendou" | "perdido" | "outro" | "sem_desfecho";

const OUTCOME_LABELS: Record<string, { label: string; group: OutcomeGroup }> = {
  AGENDAMENTO_CONCLUIDO: { label: "Agendou", group: "agendou" },
  PERDA_PRECO: { label: "Perdido — preço", group: "perdido" },
  PERDA_CONVENIO: { label: "Perdido — convênio não atendido", group: "perdido" },
  PERDA_HORARIO: { label: "Perdido — horário/agenda", group: "perdido" },
  PERDA_OUTRO: { label: "Perdido — outro motivo", group: "perdido" },
  CANCELAMENTO: { label: "Desistiu / cancelou", group: "perdido" },
  DUVIDA_ESCLARECIDA: { label: "Dúvida esclarecida", group: "outro" },
  ORCAMENTO_ENVIADO: { label: "Orçamento enviado", group: "outro" },
  CONFIRMACAO_AGENDA: { label: "Confirmou a agenda", group: "outro" },
  AGENDAMENTO_REMARCADO: { label: "Remarcou", group: "outro" },
  AGENDAMENTO_CANCELADO: { label: "Cancelou agendamento", group: "outro" },
  ENCAMINHADO: { label: "Encaminhado a outro setor", group: "outro" },
  ATENDIDO_NO_CELULAR: { label: "Atendido pelo celular", group: "outro" },
  ATENDIMENTO_CONCLUIDO: { label: "Conversa já tinha terminado", group: "outro" },
  INATIVIDADE: { label: "Encerrada por inatividade", group: "sem_desfecho" },
  SEM_RESPOSTA: { label: "Paciente não respondeu", group: "sem_desfecho" },
};
/** Rótulo curto do motivo de finalização (relatório e filtro "motivo" de Pacientes). */
export function outcomeLabel(reason: string) {
  const custom = customLossReasonLabel(reason);
  return OUTCOME_LABELS[reason]?.label ?? (custom ? `Perdido — ${custom}` : reason);
}

const GROUP_ORDER: OutcomeGroup[] = ["agendou", "perdido", "outro", "sem_desfecho"];

export type OutcomeRow = { reason: string; label: string; group: OutcomeGroup; count: number; pct: number };

/** "Por que as conversas terminaram": conversas resolvidas por motivo de finalização,
 * agrupadas (agendou → perdido → outros → sem desfecho). % sobre todas as resolvidas. */
export function computeOutcomes(conversations: { status: string; resolutionReason: string | null }[]) {
  const resolved = conversations.filter((c) => c.status === "RESOLVED");
  const counts = new Map<string, number>();
  for (const c of resolved) {
    const key = c.resolutionReason ?? "OUTRO";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const rows: OutcomeRow[] = [...counts.entries()].map(([reason, count]) => {
    const custom = customLossReasonLabel(reason);
    const meta =
      OUTCOME_LABELS[reason] ??
      (custom ? { label: `Perdido — ${custom}`, group: "perdido" as const } : { label: "Outro motivo", group: "outro" as const });
    return { reason, label: meta.label, group: meta.group, count, pct: pct(count, resolved.length) };
  });
  rows.sort((a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || b.count - a.count);
  const lost = rows.filter((r) => r.group === "perdido");
  const lostTotal = lost.reduce((s, r) => s + r.count, 0);
  return {
    resolved: resolved.length,
    withOutcome: resolved.filter(hasOutcome).length,
    noOutcome: rows.filter((r) => r.group === "sem_desfecho").reduce((s, r) => s + r.count, 0),
    lostTotal,
    topLossReason: lost[0] ?? null,
    rows,
  };
}

export type ReminderAppointment = {
  reminderSentAt: Date | null;
  reminderStatus: string | null;
  status: string;
  date: Date;
};

/** Só agendamentos que receberam lembrete entram. "Sem retorno" = lembrete enviado,
 * paciente não confirmou nem cancelou, e a data da consulta já passou. */
export function computeConfirmationStats(appointments: ReminderAppointment[], now: Date = new Date()) {
  const sent = appointments.filter((a) => a.reminderSentAt !== null);
  const confirmed = sent.filter((a) => a.reminderStatus === "CONFIRMED").length;
  const cancelled = sent.filter((a) => a.status === "CANCELLED").length;
  const noReply = sent.filter(
    (a) => a.reminderStatus !== "CONFIRMED" && a.status !== "CANCELLED" && a.date.getTime() < now.getTime()
  ).length;
  return {
    totalSent: sent.length,
    confirmed,
    confirmedPct: pct(confirmed, sent.length),
    cancelled,
    cancelledPct: pct(cancelled, sent.length),
    // Agendamentos do painel não têm "quer remarcar" (só o lembrete do bridge tem).
    rescheduled: 0,
    rescheduledPct: 0,
    noReply,
    noReplyPct: pct(noReply, sent.length),
  };
}

const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase().replace(/\s+/g, " ");

/** doctorName é texto livre (e vem em CAIXA ALTA do Firebird), então agrupa por nome
 * normalizado e exibe em title case. */
export function computeTopDoctors(doctorNames: (string | null)[], limit = 5) {
  const counts = new Map<string, { name: string; count: number }>();
  for (const raw of doctorNames) {
    if (!raw || !raw.trim()) continue;
    const key = normalizeName(raw);
    const entry = counts.get(key) ?? { name: toTitleCaseName(raw.trim()), count: 0 };
    entry.count++;
    counts.set(key, entry);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, limit);
}

export type AppointmentKind = "CONSULTA" | "RETORNO" | "EXAME";

/** Não existe campo "retorno" no banco — deriva do nome do procedimento. Consulta vem
 * da categoria CONSULTATION; EXAM/SURGERY viram "Exame/Procedimento". */
export function classifyAppointmentKind(procedureName: string, category: string): AppointmentKind {
  if (normalizeName(procedureName).includes("retorno")) return "RETORNO";
  return category === "CONSULTATION" ? "CONSULTA" : "EXAME";
}

export function computeKindDistribution(items: { procedureName: string; category: string }[]) {
  const dist: Record<AppointmentKind, number> = { CONSULTA: 0, RETORNO: 0, EXAME: 0 };
  for (const i of items) dist[classifyAppointmentKind(i.procedureName, i.category)]++;
  return dist;
}

export const PEAK_HOUR_START = 8;
export const PEAK_HOUR_END = 18;

const hourFormatter = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" });

/** Mensagens recebidas por hora cheia (08h–18h, horário de Brasília). */
export function computeHourlyInbound(timestamps: Date[]) {
  const buckets = Array.from({ length: PEAK_HOUR_END - PEAK_HOUR_START + 1 }, (_, i) => ({
    hour: PEAK_HOUR_START + i,
    count: 0,
  }));
  for (const t of timestamps) {
    const hour = Number(hourFormatter.format(t));
    if (hour >= PEAK_HOUR_START && hour <= PEAK_HOUR_END) buckets[hour - PEAK_HOUR_START].count++;
  }
  return buckets;
}

export type ConfirmationStats = ReturnType<typeof computeConfirmationStats>;
export type BridgeConfirmationCounts = { sent: number; confirmed: number; cancelled: number; rescheduled: number; noReply: number };

/** Lembretes D-1 do bridge (BridgeReminderLog) — o agendamento não existe no nosso banco,
 * então a resposta fica no próprio log (gravada pelo webhook). "Remarcar" tem contagem
 * própria (crítica de Relatórios: somado em "cancelados" não fechava à vista). Sem resposta só conta depois de 1 dia (a consulta já passou). */
export function computeBridgeConfirmationStats(
  logs: { response: string | null; sentAt: Date }[],
  now: Date = new Date()
): BridgeConfirmationCounts {
  const dayAgo = now.getTime() - 86400000;
  return {
    sent: logs.length,
    confirmed: logs.filter((l) => l.response === "CONFIRMED").length,
    cancelled: logs.filter((l) => l.response === "CANCELLED").length,
    rescheduled: logs.filter((l) => l.response === "RESCHEDULE").length,
    noReply: logs.filter((l) => l.response === null && l.sentAt.getTime() < dayAgo).length,
  };
}

export function mergeConfirmationStats(a: ConfirmationStats, b: BridgeConfirmationCounts): ConfirmationStats {
  const totalSent = a.totalSent + b.sent;
  const confirmed = a.confirmed + b.confirmed;
  const cancelled = a.cancelled + b.cancelled;
  const rescheduled = a.rescheduled + b.rescheduled;
  const noReply = a.noReply + b.noReply;
  return {
    totalSent,
    confirmed,
    confirmedPct: pct(confirmed, totalSent),
    cancelled,
    cancelledPct: pct(cancelled, totalSent),
    rescheduled,
    rescheduledPct: pct(rescheduled, totalSent),
    noReply,
    noReplyPct: pct(noReply, totalSent),
  };
}

export const UNIDENTIFIED_CHANNEL = "Não identificado";

/** Conversão por canal de aquisição — mesma base do card de conversão do chat
 * (agendamentos / conversas com desfecho, sem inatividade). Receita = agendamentos × ticket médio (não há
 * vínculo Conversation↔Appointment pra saber o procedimento de cada uma). */
export function computeChannelConversion(
  conversations: { acquisitionChannel: string | null; status: string; resolutionReason: string | null }[],
  ticket: number | null
) {
  const byChannel = new Map<string, { conversations: number; withOutcome: number; scheduled: number }>();
  for (const c of conversations) {
    const key = c.acquisitionChannel ?? UNIDENTIFIED_CHANNEL;
    const e = byChannel.get(key) ?? { conversations: 0, withOutcome: 0, scheduled: 0 };
    e.conversations++;
    if (hasOutcome(c)) e.withOutcome++;
    if (c.resolutionReason === "AGENDAMENTO_CONCLUIDO") e.scheduled++;
    byChannel.set(key, e);
  }
  return [...byChannel.entries()]
    .map(([channel, e]) => ({
      channel,
      conversations: e.conversations,
      scheduled: e.scheduled,
      conversionRate: e.withOutcome > 0 ? pct(e.scheduled, e.withOutcome) : null,
      estimatedRevenue: ticket !== null ? e.scheduled * ticket : null,
    }))
    .sort((a, b) => b.scheduled - a.scheduled || b.conversations - a.conversations);
}

export type ResponseTimingRow = { firstInboundAt: Date; firstHumanReplyAt: Date | null; resolvedAt: Date | null };

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** D3 — tempos do relatório legíveis: MEDIANA (uma conversa esquecida não puxa tudo pra
 * "2734h"), só minutos de EXPEDIENTE da clínica, e só conversas com resposta humana
 * (painel ou celular — mensagem automática não conta). Resolução também a partir da
 * 1ª mensagem do paciente. SLA = 1ª resposta em até SLA_WARNING_MINUTES de expediente. */
export function computeResponseStats(rows: ResponseTimingRow[], businessHours: BusinessHours | null) {
  const answered = rows.filter((r) => r.firstHumanReplyAt);
  const frt = answered.map((r) => computeBusinessMinutesElapsed(r.firstInboundAt, r.firstHumanReplyAt!, businessHours));
  const ttr = answered
    .filter((r) => r.resolvedAt)
    .map((r) => computeBusinessMinutesElapsed(r.firstInboundAt, r.resolvedAt!, businessHours));
  return {
    answered: answered.length,
    unanswered: rows.length - answered.length,
    medianFirstResponseMin: median(frt),
    medianResolutionMin: median(ttr),
    withinSlaPct: frt.length ? pct(frt.filter((m) => m <= SLA_WARNING_MINUTES).length, frt.length) : null,
  };
}
