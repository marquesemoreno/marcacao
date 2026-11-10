/**
 * Fechamento do ciclo de anúncios (09/11/2026, site da Urolaser — docs/RASTREAMENTO.md do
 * repositório urolaservca). Puro, testável sem banco.
 *
 * 1. O site, com consentimento e clique pago (gclid/fbclid), manda um POST para
 *    /api/track/click com um token de 6 letras e acrescenta "ref:<token>" ao texto do WhatsApp.
 * 2. A conversa que chega com "ref:<token>" é ligada ao clique (AdClick).
 * 3. Quando o lead agenda/comparece, o cron ad-conversions grava AdConversion e manda à Meta
 *    (Conversions API) só o nome do evento, a hora e o fbc; o Google Ads busca a planilha
 *    /api/conversions/google-ads (só gclid, nome genérico da conversão e hora).
 *
 * Nada clínico sai daqui: nem especialidade, nem página do site, nem telefone.
 */
import { CAMPAIGN_CODE_PATTERN } from "./acquisition";
import { phoneTail as tailOf } from "./marcadores";

/** Alfabeto do track.js (sem i, l, o, 0, 1), 6 caracteres. Aceita qualquer [a-z0-9] por folga. */
const REF_PATTERN = /(?<![\w:])ref:([a-z0-9]{6})(?![a-z0-9])/i;

export function extractClickRef(text: string | null | undefined): string | null {
  const m = text ? REF_PATTERN.exec(text) : null;
  return m ? m[1].toLowerCase() : null;
}

/** Texto da mensagem sem os códigos técnicos (origem, ref:, utm_…) — só para exibir. O
 * conteúdo gravado continua com eles (é o que alimenta a origem do lead). */
export function stripTrackingCodes(text: string): string {
  if (!text || !/#|ref:|utm_/i.test(text)) return text;
  const code = new RegExp(`\\s*${CAMPAIGN_CODE_PATTERN.source}`, "gi");
  return text
    .replace(/\s*(?<![\w:])ref:[a-z0-9]{6}(?![a-z0-9])/gi, "")
    .replace(/\s*\butm_[a-z]+=[^\s]*/gi, "")
    .replace(code, "")
    .replace(/[ \t]+([.!?,])/g, "$1")
    .trim();
}

// ---------------------------------------------------------------------------------------
// Corpo do POST do site
// ---------------------------------------------------------------------------------------

export type ClickRecord = {
  token: string;
  gclid: string | null;
  gbraid: string | null;
  wbraid: string | null;
  fbclid: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
};

/** Tamanho máximo do corpo aceito pelo endpoint (o do track.js tem ~400 bytes). */
export const MAX_CLICK_BODY_BYTES = 2048;

const CLICK_ID = /^[\w-]{4,200}$/;

function clickId(v: unknown): string | null | false {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !CLICK_ID.test(v)) return false;
  return v;
}

function text(v: unknown, max = 100): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);
  return t || null;
}

/** Valida o corpo do track.js e guarda só o necessário: token, identificadores de clique e
 * utm_*. Página de entrada e referrer são descartados de propósito (podem revelar o assunto
 * de saúde que a pessoa leu). `null` = corpo inválido. */
export function parseClickPayload(body: unknown): ClickRecord | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as { token?: unknown; params?: unknown };
  if (typeof b.token !== "string" || !/^[a-z0-9]{6}$/i.test(b.token)) return null;
  const p = (b.params && typeof b.params === "object" ? b.params : {}) as Record<string, unknown>;
  const ids = { gclid: clickId(p.gclid), gbraid: clickId(p.gbraid), wbraid: clickId(p.wbraid), fbclid: clickId(p.fbclid) };
  if (Object.values(ids).some((v) => v === false)) return null;
  if (!ids.gclid && !ids.gbraid && !ids.wbraid && !ids.fbclid) return null;
  return {
    token: b.token.toLowerCase(),
    gclid: ids.gclid || null,
    gbraid: ids.gbraid || null,
    wbraid: ids.wbraid || null,
    fbclid: ids.fbclid || null,
    utmSource: text(p.utm_source),
    utmMedium: text(p.utm_medium),
    utmCampaign: text(p.utm_campaign),
    utmContent: text(p.utm_content),
    utmTerm: text(p.utm_term),
  };
}

// ---------------------------------------------------------------------------------------
// Meta Conversions API
// ---------------------------------------------------------------------------------------

/** Parâmetro fbc a partir do fbclid: fb.1.<ms do clique>.<fbclid>. */
export function buildFbc(fbclid: string, clickedAt: Date): string {
  return `fb.1.${clickedAt.getTime()}.${fbclid}`;
}

/** Evento mínimo: sem custom_data, sem event_source_url, sem telefone/e-mail. A categoria
 * "saúde e bem-estar" da Meta pode bloquear parâmetros personalizados e trechos de URL —
 * aqui não vai nenhum dos dois. */
export function buildMetaEvent(input: {
  eventName: string;
  eventId: string;
  occurredAt: Date;
  fbclid: string;
  clickedAt: Date;
}) {
  return {
    event_name: input.eventName,
    event_time: Math.floor(input.occurredAt.getTime() / 1000),
    event_id: input.eventId,
    action_source: "system_generated" as const,
    user_data: { fbc: buildFbc(input.fbclid, input.clickedAt) },
  };
}

// ---------------------------------------------------------------------------------------
// Google Ads — planilha de importação de conversões offline
// ---------------------------------------------------------------------------------------

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Hora em America/Bahia (UTC-3, sem horário de verão). */
function bahiaTime(d: Date): string {
  return new Date(d.getTime() - 3 * 3_600_000).toISOString().replace("T", " ").slice(0, 19);
}

export function buildGoogleAdsCsv(rows: { gclid: string; conversionName: string; occurredAt: Date }[]): string {
  const lines = ["Parameters:TimeZone=-0300", "Google Click ID,Conversion Name,Conversion Time"];
  for (const r of rows) lines.push([csvCell(r.gclid), csvCell(r.conversionName), bahiaTime(r.occurredAt)].join(","));
  return lines.join("\n") + "\n";
}

// ---------------------------------------------------------------------------------------
// Agendou / compareceu (mesma regra do relatório de marcadores)
// ---------------------------------------------------------------------------------------

/** Status da Agenda que contam como comparecimento (Chegou / Em sala / Atendido). */
export const ATTENDED_MARK_STATUSES = ["IN_SERVICE", "IN_ROOM", "COMPLETED"];

export type LeadOutcomeInput = {
  /** Início do contato (criação da conversa). Nada antes disso conta. */
  since: Date;
  phoneTail: string | null;
  /** Primeira vez que a conversa foi para "Agendado" no CRM ou finalizada como agendamento. */
  stageScheduledAt: Date | null;
  appointments: { patientPhone: string; createdAt: Date; status: string; updatedAt: Date }[];
  reminders: { phone: string | null; sentAt: Date }[];
  marks: { phone: string | null; date: Date; updatedAt: Date }[];
};

const minDate = (ds: (Date | null | undefined)[]) =>
  ds.filter((d): d is Date => !!d).reduce<Date | null>((a, d) => (!a || d < a ? d : a), null);

export function computeLeadOutcome(i: LeadOutcomeInput): { scheduledAt: Date | null; attendedAt: Date | null } {
  const same = (phone: string | null) => !!phone && !!i.phoneTail && tailOf(phone) === i.phoneTail;
  const sinceDay = new Date(i.since.toISOString().slice(0, 10));
  const appts = i.appointments.filter((a) => same(a.patientPhone) && a.createdAt >= i.since);
  const attendedAt = minDate([
    ...i.marks.filter((m) => same(m.phone) && m.date >= sinceDay).map((m) => m.updatedAt),
    ...appts.filter((a) => a.status === "COMPLETED").map((a) => a.updatedAt),
  ]);
  const scheduledAt = minDate([
    i.stageScheduledAt,
    ...appts.map((a) => a.createdAt),
    ...i.reminders.filter((r) => same(r.phone) && r.sentAt >= i.since).map((r) => r.sentAt),
    attendedAt,
  ]);
  return { scheduledAt, attendedAt };
}
