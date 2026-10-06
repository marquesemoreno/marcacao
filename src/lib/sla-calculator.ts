import type { BusinessHours } from "@/lib/schemas/clinic";

export type SlaVariant = "normal" | "warning" | "critical";

export interface SlaInfo {
  shouldDisplay: boolean;
  waitingMinutes: number;
  /** Espera em tempo real (não só expediente) — ordena a fila (ver queue-order.ts). */
  realWaitingMinutes: number;
  formattedTime: string;
  variant: SlaVariant;
}

/** Mesmo default de src/lib/business-hours.ts — usado quando a clínica ainda não
 * configurou expediente próprio (Clinic.businessHours null/vazio). */
const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  seg: { open: "08:00", close: "18:00" },
  ter: { open: "08:00", close: "18:00" },
  qua: { open: "08:00", close: "18:00" },
  qui: { open: "08:00", close: "18:00" },
  sex: { open: "08:00", close: "18:00" },
  sab: { open: "08:00", close: "12:00" },
  dom: { closed: true },
};

const DAY_KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"] as const;

/** Brasil não tem horário de verão desde 2019 (abolido em todo o território) — por
 * isso um offset fixo é seguro aqui, diferente de fusos com DST. Evita depender da
 * tabela de timezone do runtime (Intl) pra um cálculo que precisa ser determinístico
 * e testável. Ver ressalva sobre business-hours.ts (usa hora local do processo, não
 * um fuso explícito) no plano desta mudança — este arquivo não repete esse problema. */
const BRAZIL_UTC_OFFSET_HOURS = 3;

function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + (m || 0);
}

/** Minutos de expediente sobrepostos ao intervalo [from, to] dentro de UM dia
 * específico (identificado por brazilDayStartUtcMs, meia-noite daquele dia já em
 * "hora do Brasil representada como UTC", ver computeBusinessMinutesElapsed). */
function overlapMinutesForDay(
  brazilDayStartUtcMs: number,
  dayConfig: { closed?: boolean; open?: string; close?: string } | undefined,
  fromBrMs: number,
  toBrMs: number
): number {
  if (!dayConfig || dayConfig.closed || !dayConfig.open || !dayConfig.close) return 0;
  const openMs = brazilDayStartUtcMs + parseHHMM(dayConfig.open) * 60_000;
  const closeMs = brazilDayStartUtcMs + parseHHMM(dayConfig.close) * 60_000;
  const overlapStart = Math.max(openMs, fromBrMs);
  const overlapEnd = Math.min(closeMs, toBrMs);
  return overlapEnd > overlapStart ? (overlapEnd - overlapStart) / 60_000 : 0;
}

/** Minutos "úteis" (dentro do expediente configurado) entre `from` e `to` — pula
 * noites/fins de semana/feriado semanal fechado. Percorre dia a dia (raramente mais
 * que 2-3 dias numa fila de atendimento de verdade) somando só a sobreposição de cada
 * dia com a janela de expediente. */
export function computeBusinessMinutesElapsed(from: Date, to: Date, businessHours: BusinessHours | null): number {
  if (to.getTime() <= from.getTime()) return 0;
  const hours = businessHours ?? DEFAULT_BUSINESS_HOURS;

  // Desloca pra "hora do Brasil representada como instante UTC" — dá pra usar
  // getUTCDay()/aritmética de ms direto, sem depender do fuso do processo.
  const fromBrMs = from.getTime() - BRAZIL_UTC_OFFSET_HOURS * 3_600_000;
  const toBrMs = to.getTime() - BRAZIL_UTC_OFFSET_HOURS * 3_600_000;

  const firstDayStart = Math.floor(fromBrMs / 86_400_000) * 86_400_000;
  const lastDayStart = Math.floor(toBrMs / 86_400_000) * 86_400_000;

  let totalMinutes = 0;
  for (let dayStart = firstDayStart; dayStart <= lastDayStart; dayStart += 86_400_000) {
    const dayKey = DAY_KEYS[new Date(dayStart).getUTCDay()];
    const dayConfig = hours[dayKey] ?? DEFAULT_BUSINESS_HOURS[dayKey];
    totalMinutes += overlapMinutesForDay(dayStart, dayConfig, fromBrMs, toBrMs);
  }
  return Math.floor(totalMinutes);
}

export function formatSlaTime(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours}h` : `${hours}h ${remainder}m`;
}

/** SLA da recepção (decisão do produto, 2026-10-02): âmbar a partir de 15 min e
 * vermelho a partir de 60 min de espera, contados em minutos de expediente. */
export const SLA_WARNING_MINUTES = 15;
export const SLA_CRITICAL_MINUTES = 60;

function variantFor(minutes: number): SlaVariant {
  if (minutes >= SLA_CRITICAL_MINUTES) return "critical";
  if (minutes >= SLA_WARNING_MINUTES) return "warning";
  return "normal";
}

/** Duração em linguagem humana — "14 min", "3 h", "2 dias". Usada na fila (espera) e
 * nos relatórios (tempo de resposta/resolução). */
export function formatDurationHuman(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return "menos de 1 min";
  if (m < 60) return `${m} min`;
  const hours = Math.round(m / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(m / 1440);
  return days === 1 ? "1 dia" : `${days} dias`;
}

type SlaMessage = { direction: "INBOUND" | "OUTBOUND"; type?: string; createdAt: Date };

/** Fonte única do "tempo de espera" da fila (C4). Conta desde a 1ª mensagem do
 * paciente ainda sem resposta da clínica (nota interna não é resposta); se a última
 * mensagem é da clínica, não há espera. `formattedTime` é tempo REAL (o que o paciente
 * sentiu — antes era só minutos de expediente e mostrava "1m" pra mensagem de ontem);
 * a cor (`variant`) usa minutos de expediente contra o SLA 15/60. `recentMessages`
 * vem da mais nova pra mais antiga (o take do listConversations). */
export function getSlaInfo(input: {
  recentMessages: SlaMessage[];
  conversationStatus: string;
  businessHours: BusinessHours | null;
  now?: Date;
}): SlaInfo {
  const now = input.now ?? new Date();
  const real = input.recentMessages.filter((m) => m.type !== "INTERNAL_NOTE");
  if (input.conversationStatus === "RESOLVED" || real.length === 0 || real[0].direction !== "INBOUND") {
    return { shouldDisplay: false, waitingMinutes: 0, realWaitingMinutes: 0, formattedTime: "", variant: "normal" };
  }
  let firstUnanswered = real[0];
  for (const m of real) {
    if (m.direction !== "INBOUND") break;
    firstUnanswered = m;
  }
  const waitingMinutes = computeBusinessMinutesElapsed(firstUnanswered.createdAt, now, input.businessHours);
  const realMinutes = (now.getTime() - firstUnanswered.createdAt.getTime()) / 60_000;
  return {
    shouldDisplay: true,
    waitingMinutes,
    realWaitingMinutes: Math.round(realMinutes),
    formattedTime: formatDurationHuman(realMinutes),
    variant: variantFor(waitingMinutes),
  };
}
