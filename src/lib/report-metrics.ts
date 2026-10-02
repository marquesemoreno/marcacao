/** Agregações puras do /clinic/relatorio (seções de equipe, confirmações, médicos,
 * tipo de atendimento e horário de pico) — separadas das queries em
 * src/actions/clinic.ts pra dar pra testar sem banco. */
import { toTitleCaseName } from "./format";
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
  scheduled: number;
  conversionRate: number;
  avgFrtSec: number | null;
};

/** Conversão = agendamentos / conversas RESOLVIDAS pelo atendente (mesma base do card
 * "Conversão em Agendamento" do bloco de chat). Conversas sem atendente ficam de fora. */
export function computeAttendantPerformance(conversations: AttendantConversation[]): AttendantRow[] {
  const byUser = new Map<string, { name: string; total: number; resolved: number; scheduled: number; frt: number[] }>();
  for (const c of conversations) {
    if (!c.userId) continue;
    const entry = byUser.get(c.userId) ?? { name: c.userName ?? "—", total: 0, resolved: 0, scheduled: 0, frt: [] };
    entry.total++;
    if (c.status === "RESOLVED") entry.resolved++;
    if (c.resolutionReason === "AGENDAMENTO_CONCLUIDO") entry.scheduled++;
    if (c.firstResponseSec !== null) entry.frt.push(c.firstResponseSec);
    byUser.set(c.userId, entry);
  }
  return [...byUser.entries()]
    .map(([userId, e]) => ({
      userId,
      userName: e.name,
      total: e.total,
      scheduled: e.scheduled,
      conversionRate: pct(e.scheduled, e.resolved),
      avgFrtSec: e.frt.length > 0 ? Math.round(e.frt.reduce((a, b) => a + b, 0) / e.frt.length) : null,
    }))
    .sort((a, b) => b.conversionRate - a.conversionRate || b.total - a.total);
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
export type BridgeConfirmationCounts = { sent: number; confirmed: number; cancelled: number; noReply: number };

/** Lembretes D-1 do bridge (BridgeReminderLog) — o agendamento não existe no nosso banco,
 * então a resposta fica no próprio log (gravada pelo webhook). "Remarcar" conta como
 * liberado (o horário vaga). Sem resposta só conta depois de 1 dia (a consulta já passou). */
export function computeBridgeConfirmationStats(
  logs: { response: string | null; sentAt: Date }[],
  now: Date = new Date()
): BridgeConfirmationCounts {
  const dayAgo = now.getTime() - 86400000;
  return {
    sent: logs.length,
    confirmed: logs.filter((l) => l.response === "CONFIRMED").length,
    cancelled: logs.filter((l) => l.response === "CANCELLED" || l.response === "RESCHEDULE").length,
    noReply: logs.filter((l) => l.response === null && l.sentAt.getTime() < dayAgo).length,
  };
}

export function mergeConfirmationStats(a: ConfirmationStats, b: BridgeConfirmationCounts): ConfirmationStats {
  const totalSent = a.totalSent + b.sent;
  const confirmed = a.confirmed + b.confirmed;
  const cancelled = a.cancelled + b.cancelled;
  const noReply = a.noReply + b.noReply;
  return {
    totalSent,
    confirmed,
    confirmedPct: pct(confirmed, totalSent),
    cancelled,
    cancelledPct: pct(cancelled, totalSent),
    noReply,
    noReplyPct: pct(noReply, totalSent),
  };
}

export const UNIDENTIFIED_CHANNEL = "Não identificado";

/** Conversão por canal de aquisição — mesma base do card de conversão do chat
 * (agendamentos / conversas resolvidas). Receita = agendamentos × ticket médio (não há
 * vínculo Conversation↔Appointment pra saber o procedimento de cada uma). */
export function computeChannelConversion(
  conversations: { acquisitionChannel: string | null; status: string; resolutionReason: string | null }[],
  ticket: number | null
) {
  const byChannel = new Map<string, { conversations: number; resolved: number; scheduled: number }>();
  for (const c of conversations) {
    const key = c.acquisitionChannel ?? UNIDENTIFIED_CHANNEL;
    const e = byChannel.get(key) ?? { conversations: 0, resolved: 0, scheduled: 0 };
    e.conversations++;
    if (c.status === "RESOLVED") e.resolved++;
    if (c.resolutionReason === "AGENDAMENTO_CONCLUIDO") e.scheduled++;
    byChannel.set(key, e);
  }
  return [...byChannel.entries()]
    .map(([channel, e]) => ({
      channel,
      conversations: e.conversations,
      scheduled: e.scheduled,
      conversionRate: pct(e.scheduled, e.resolved),
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
