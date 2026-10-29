/** Análises extras do /clinic/relatorio (out/2026): funil com oportunidade perdida,
 * tendência semanal, pacientes novos x retorno, risco de falta da agenda do bridge e os
 * fatos objetivos que alimentam o resumo com IA. Tudo puro — testado em
 * report-insights.test.ts; as queries ficam em src/actions/clinic-insights.ts. */

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (part: number, total: number) => (total > 0 ? round1((part / total) * 100) : 0);

export type FunnelStepKey = "conversas" | "atendidas" | "com_desfecho" | "agendaram";
export const FUNNEL_LABELS: Record<FunnelStepKey, string> = {
  conversas: "Conversas",
  atendidas: "Atendidas",
  com_desfecho: "Com desfecho",
  agendaram: "Agendaram",
};

export function computeFunnel(input: {
  total: number;
  answered: number;
  withOutcome: number;
  scheduled: number;
  lost: number;
  noOutcome: number;
  ticket: number | null;
}) {
  const raw: [FunnelStepKey, number][] = [
    ["conversas", input.total],
    ["atendidas", input.answered],
    ["com_desfecho", input.withOutcome],
    ["agendaram", input.scheduled],
  ];
  const steps = raw.map(([key, count]) => ({ key, label: FUNNEL_LABELS[key], count, pctOfTotal: pct(count, input.total) }));
  let biggestDrop: { from: FunnelStepKey; to: FunnelStepKey; lost: number } | null = null;
  for (let i = 1; i < steps.length; i++) {
    const lost = steps[i - 1].count - steps[i].count;
    if (lost > 0 && (!biggestDrop || lost > biggestDrop.lost)) biggestDrop = { from: steps[i - 1].key, to: steps[i].key, lost };
  }
  const patients = input.lost + input.noOutcome;
  return { steps, biggestDrop, opportunity: { patients, value: input.ticket === null ? null : patients * input.ticket } };
}

const BRT_OFFSET_MS = 3 * 3_600_000;
const DAY_MS = 86_400_000;

/** Início (UTC) da semana de Brasília (segunda 00:00) que contém `d`. */
function weekStart(d: Date): number {
  const local = new Date(d.getTime() - BRT_OFFSET_MS);
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate());
  const sinceMonday = (local.getUTCDay() + 6) % 7;
  return midnight - sinceMonday * DAY_MS + BRT_OFFSET_MS;
}

function ddmm(utcMs: number) {
  const local = new Date(utcMs - BRT_OFFSET_MS);
  return `${String(local.getUTCDate()).padStart(2, "0")}/${String(local.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function computeWeeklyTrend(rows: { createdAt: Date; scheduled: boolean }[], since: Date, until: Date) {
  const buckets = new Map<number, { conversations: number; scheduled: number }>();
  for (let w = weekStart(since); w < until.getTime(); w += 7 * DAY_MS) buckets.set(w, { conversations: 0, scheduled: 0 });
  for (const r of rows) {
    const b = buckets.get(weekStart(r.createdAt));
    if (!b) continue;
    b.conversations++;
    if (r.scheduled) b.scheduled++;
  }
  return [...buckets.entries()].map(([w, b]) => ({
    label: ddmm(w),
    conversations: b.conversations,
    scheduled: b.scheduled,
    rate: b.conversations > 0 ? pct(b.scheduled, b.conversations) : null,
  }));
}

/** Novo = a 1ª conversa do contato com a clínica caiu dentro do período. */
export function computeNewVsReturning(rows: { contactId: string; firstConversationAt: Date }[], since: Date) {
  const seen = new Map<string, Date>();
  for (const r of rows) {
    const prev = seen.get(r.contactId);
    if (!prev || r.firstConversationAt < prev) seen.set(r.contactId, r.firstConversationAt);
  }
  let newPatients = 0;
  let returning = 0;
  for (const first of seen.values()) {
    if (first >= since) newPatients++;
    else returning++;
  }
  return { newPatients, returning, newPct: pct(newPatients, newPatients + returning) };
}

export type AgendaRiskRow = { key: string; total: number; reminded: number; confirmed: number; cancelled: number; noReply: number; riskPct: number };
const WEEKDAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

/** Agenda do sistema da clínica × resposta ao lembrete D-1 (por NUMERO do agendamento).
 * Risco = cancelou ou não respondeu, sobre quem recebeu lembrete. Sem lembrete (sem
 * telefone, paciente marcado no mesmo dia) conta só no total. */
export function computeAgendaRisk(
  items: { numero: number; medico: string | null; date: string; hora?: string }[],
  responses: Map<number, string | null>
) {
  const empty = (key: string): AgendaRiskRow => ({ key, total: 0, reminded: 0, confirmed: 0, cancelled: 0, noReply: 0, riskPct: 0 });
  const byDoctor = new Map<string, AgendaRiskRow>();
  const byWeekday = new Map<number, AgendaRiskRow>();
  const overall = empty("Total");
  for (const item of items) {
    const [y, m, d] = item.date.split("-").map(Number);
    const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    const doctor = item.medico?.trim() || "Sem médico";
    if (!byDoctor.has(doctor)) byDoctor.set(doctor, empty(doctor));
    if (!byWeekday.has(wd)) byWeekday.set(wd, empty(WEEKDAYS[wd]));
    for (const row of [byDoctor.get(doctor)!, byWeekday.get(wd)!, overall]) {
      row.total++;
      if (!responses.has(item.numero)) continue;
      row.reminded++;
      const r = responses.get(item.numero);
      if (r === "CONFIRMED") row.confirmed++;
      else if (r === "CANCELLED") row.cancelled++;
      else if (r === null) row.noReply++;
    }
  }
  const finish = (row: AgendaRiskRow) => ({ ...row, riskPct: pct(row.cancelled + row.noReply, row.reminded) });
  return {
    byDoctor: [...byDoctor.values()].map(finish).sort((a, b) => b.total - a.total),
    byWeekday: WEEKDAY_ORDER.filter((wd) => byWeekday.has(wd)).map((wd) => finish(byWeekday.get(wd)!)),
    overall: finish(overall),
  };
}

type Pair = { current: number | null; previous: number | null };
const fmtNum = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

/** Fatos objetivos (só variações relevantes) que a IA transforma em resumo — e que
 * aparecem sozinhos se a IA não responder. */
export function buildInsightFacts(m: {
  conversionRate?: Pair;
  medianFirstReplyMin?: Pair;
  conversations?: Pair;
  topLostReason?: { label: string; count: number } | null;
  biggestDrop?: { from: FunnelStepKey; to: FunnelStepKey; lost: number } | null;
  riskiestWeekday?: { key: string; riskPct: number } | null;
  opportunity?: { patients: number; value: number | null } | null;
}): string[] {
  const facts: string[] = [];
  const cr = m.conversionRate;
  if (cr && cr.current !== null && cr.previous !== null && Math.abs(cr.current - cr.previous) >= 3) {
    const diff = Math.round(cr.current - cr.previous);
    facts.push(
      `Conversão ${diff < 0 ? "caiu" : "subiu"} de ${fmtNum(cr.previous)}% para ${fmtNum(cr.current)}% (${diff < 0 ? "−" : "+"}${Math.abs(diff)} pts).`
    );
  }
  const fr = m.medianFirstReplyMin;
  if (fr && fr.current !== null && fr.previous !== null && fr.previous > 0) {
    const rel = Math.abs(fr.current - fr.previous) / fr.previous;
    if (rel >= 0.25 && Math.abs(fr.current - fr.previous) >= 3) {
      facts.push(`Tempo até a 1ª resposta ${fr.current > fr.previous ? "subiu" : "caiu"} de ${Math.round(fr.previous)} min para ${Math.round(fr.current)} min.`);
    }
  }
  const cv = m.conversations;
  if (cv && cv.current !== null && cv.previous !== null && cv.previous > 0) {
    const rel = Math.round(((cv.current - cv.previous) / cv.previous) * 100);
    if (Math.abs(rel) >= 10) facts.push(`Conversas ${rel > 0 ? "subiram" : "caíram"} ${Math.abs(rel)}% (${cv.previous} → ${cv.current}).`);
  }
  if (m.topLostReason && m.topLostReason.count > 0) facts.push(`Principal motivo de perda: ${m.topLostReason.label} (${m.topLostReason.count}).`);
  if (m.biggestDrop) {
    facts.push(
      `Maior perda no funil: de ${FUNNEL_LABELS[m.biggestDrop.from].toLowerCase()} para ${FUNNEL_LABELS[m.biggestDrop.to].toLowerCase()} (${m.biggestDrop.lost} pacientes).`
    );
  }
  if (m.riskiestWeekday && m.riskiestWeekday.riskPct > 0) {
    facts.push(`Dia com menos confirmação: ${m.riskiestWeekday.key} (${fmtNum(m.riskiestWeekday.riskPct)}% cancelaram ou não responderam ao lembrete).`);
  }
  if (m.opportunity && m.opportunity.patients > 0) {
    facts.push(
      `Oportunidade: ${m.opportunity.patients} pacientes sem agendamento${
        m.opportunity.value !== null ? `, cerca de R$ ${m.opportunity.value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : ""
      }.`
    );
  }
  return facts;
}
