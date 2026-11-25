import { isNationalHolidayYMD } from "./holidays";

/** Regras de ritmo das campanhas de marketing (todo disparo em massa que não é o aviso de
 * remarcação) — pra não queimar o número da clínica no WhatsApp. Aviso de remarcação NÃO passa por
 * aqui: tem janela própria (08–18h todo dia, ver broadcast.ts). Brasil sem horário de verão: offset fixo -3h. */
const BRAZIL_OFFSET_MS = 3 * 3_600_000;

export const MARKETING_START_HOUR = 9;
export const MARKETING_END_HOUR = 17;
/** Máximo por campanha por dia (~1 a cada 4–6 min em 8h dá ~95). */
export const MARKETING_DAILY_CAP = 100;

/** Segunda a sexta, 09:00–17:00 de Brasília. */
export function isWithinMarketingWindow(now: Date): boolean {
  const br = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  const day = br.getUTCDay();
  if (day === 0 || day === 6) return false;
  const minutes = br.getUTCHours() * 60 + br.getUTCMinutes();
  return minutes >= MARKETING_START_HOUR * 60 && minutes < MARKETING_END_HOUR * 60;
}

export function startOfBrazilDay(now: Date): Date {
  const br = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()) + BRAZIL_OFFSET_MS);
}

/** Intervalo entre mensagens de marketing: sorteado entre 4 e 6 min a cada checagem (o
 * cron da Vercel chama a cada minuto). Controlado aqui no servidor pela última mensagem
 * enviada — chamada em dobro nunca encurta o intervalo. `random` em [0, 1). */
export function isMarketingGapElapsed(lastSentAt: Date | null, now: Date, random: number): boolean {
  if (!lastSentAt) return true;
  const gapMs = (4 + random * 2) * 60_000;
  return now.getTime() - lastSentAt.getTime() >= gapMs;
}

/** API oficial (modelo aprovado pela Meta, 25/11/2026): o intervalo de 4–6 min e o teto de
 * 100/dia existiam pelo risco de bloqueio do número não oficial (Evolution). Na API oficial o
 * limite real é o nível de mensagens da Meta (1.000 conversas novas/24h para número
 * verificado) e a nota de qualidade — então lote por minuto e teto diário POR CLÍNICA. */
export const CLOUD_PER_MINUTE = 20;
export const CLOUD_DAILY_CAP = 1000;

/** Quantas mandar neste minuto (cron a cada minuto). `sentToday` = da clínica, pela API oficial. */
export function cloudBatchSize(input: { sentToday: number; pending: number }): number {
  return Math.max(0, Math.min(CLOUD_PER_MINUTE, CLOUD_DAILY_CAP - input.sentToday, input.pending));
}

/** Mensagens por dia útil na prática: 8h de janela ÷ ~5 min de intervalo médio = 96,
 * limitado por MARKETING_DAILY_CAP. */
export const MARKETING_PER_DAY = Math.min(MARKETING_DAILY_CAP, Math.floor(((MARKETING_END_HOUR - MARKETING_START_HOUR) * 60) / 5));

function brParts(now: Date) {
  const br = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  return { br, day: br.getUTCDay(), minutes: br.getUTCHours() * 60 + br.getUTCMinutes() };
}

const isBusinessDay = (d: Date) =>
  d.getUTCDay() !== 0 && d.getUTCDay() !== 6 && !isNationalHolidayYMD(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());

/** Previsão de término de uma campanha de marketing: dias úteis (contando hoje, se
 * ainda dá pra enviar hoje) e a data do último dia. Ignora a disputa com lembretes —
 * é uma estimativa otimista e o texto da tela diz "cerca de". */
export function estimateCampaignFinish(input: {
  pending: number;
  sentToday: number;
  now: Date;
  /** Quantos envios dividem o ritmo da clínica (esta campanha + outras ativas). */
  sharing?: number;
  /** Campanha pela API oficial (modelo aprovado): ritmo CLOUD_*. */
  cloud?: boolean;
}): { businessDays: number; finishIso: string | null } {
  if (input.pending <= 0) return { businessDays: 0, finishIso: null };
  const share = Math.max(1, input.sharing ?? 1);
  const perDay = input.cloud ? Math.floor(CLOUD_DAILY_CAP / share) : Math.floor(MARKETING_PER_DAY / share);
  const dailyCap = input.cloud ? CLOUD_DAILY_CAP : MARKETING_DAILY_CAP;
  const perMinute = input.cloud ? CLOUD_PER_MINUTE / share : 1 / (5 * share);
  const { br, minutes } = brParts(input.now);
  let left = input.pending;
  let days = 0;
  const day = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()));
  // Hoje: só o que cabe no resto da janela e no limite do dia.
  if (isBusinessDay(day) && minutes < MARKETING_END_HOUR * 60) {
    const start = Math.max(minutes, MARKETING_START_HOUR * 60);
    const today = Math.min(Math.floor((MARKETING_END_HOUR * 60 - start) * perMinute), dailyCap - input.sentToday, perDay);
    if (today > 0) {
      left -= today;
      days++;
      if (left <= 0) return { businessDays: days, finishIso: day.toISOString().slice(0, 10) };
    }
  }
  for (let guard = 0; guard < 400; guard++) {
    day.setUTCDate(day.getUTCDate() + 1);
    if (!isBusinessDay(day)) continue;
    left -= perDay;
    days++;
    if (left <= 0) break;
  }
  return { businessDays: days, finishIso: day.toISOString().slice(0, 10) };
}

/** Quando a próxima janela de envio abre: "hoje às 9h", "amanhã às 9h", "segunda às 9h". */
export function nextMarketingWindowLabel(now: Date): string {
  const { day, minutes } = brParts(now);
  if (day >= 1 && day <= 5 && minutes < MARKETING_START_HOUR * 60) return `hoje às ${MARKETING_START_HOUR}h`;
  const next = (day + 1) % 7;
  if (next >= 1 && next <= 5) return `amanhã às ${MARKETING_START_HOUR}h`;
  return `segunda às ${MARKETING_START_HOUR}h`;
}

export type CampaignSituation = { tone: "ok" | "wait" | "idle" | "done"; text: string };

/** Uma frase dizendo o que a campanha está fazendo agora — pra recepção saber se está
 * andando, esperando (horário, limite, vez dos lembretes) ou parada. */
export function campaignSituation(input: {
  status: "DRAFT" | "RUNNING" | "PAUSED" | "COMPLETED";
  pending: number;
  sentToday: number;
  yielding: boolean;
  now: Date;
  /** Quantos envios dividem o ritmo agora (esta + outras campanhas ativas da clínica). */
  sharing?: number;
  /** API oficial: sentToday é da clínica e o teto é CLOUD_DAILY_CAP. */
  cloud?: boolean;
}): CampaignSituation {
  if (input.status === "DRAFT") return { tone: "idle", text: "Rascunho — ainda não começou" };
  if (input.status === "PAUSED") return { tone: "idle", text: "Pausada" };
  if (input.status === "COMPLETED" || input.pending === 0) return { tone: "done", text: "Concluída" };
  const cap = input.cloud ? CLOUD_DAILY_CAP : MARKETING_DAILY_CAP;
  if (input.sentToday >= cap) {
    return { tone: "wait", text: `Limite de hoje atingido (${cap}/${cap}) — retoma ${nextMarketingWindowLabel(new Date(startOfBrazilDay(input.now).getTime() + 86_400_000 - 60_000))}` };
  }
  if (!isWithinMarketingWindow(input.now)) return { tone: "wait", text: `Fora do horário de envio — retoma ${nextMarketingWindowLabel(input.now)}` };
  if (input.yielding) return { tone: "wait", text: "Aguardando: lembretes ou outra campanha estão na frente" };
  if (input.cloud) return { tone: "ok", text: `Enviando pela API oficial — até ${CLOUD_PER_MINUTE} por minuto, ${CLOUD_DAILY_CAP} por dia` };
  const share = Math.max(1, input.sharing ?? 1);
  if (share > 1) {
    return { tone: "ok", text: `Enviando em revezamento com ${share === 2 ? "outro envio" : `mais ${share - 1} envios`} — ~1 mensagem a cada ${share * 5} min` };
  }
  return { tone: "ok", text: "Enviando — 1 mensagem a cada 4–6 min" };
}

/** {{variaveis}} do texto que o público não tem (sairiam como "{{medico}}" pro paciente). */
export function unknownTemplateVariables(template: string, sampleVars: Record<string, string>): string[] {
  const keys = new Set(Object.keys(sampleVars).map((k) => k.toLowerCase()));
  const found = [...template.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)].map((m) => m[1]);
  return [...new Set(found.filter((k) => !keys.has(k.toLowerCase())))];
}

/** Trechos do modelo que ficaram sem preencher ("[NOME DO MÉDICO]") — sairiam assim
 * pro paciente. Só maiúsculas, pra não pegar colchetes normais do texto. */
export function unfilledPlaceholders(template: string): string[] {
  return [...new Set(template.match(/\[[A-ZÀ-Ú][A-ZÀ-Ú0-9 /-]{2,}\]/g) ?? [])];
}

/** Horário estimado de envio de cada destinatário de um aviso urgente (na ordem da fila):
 * 1 a cada `gapMin` minutos (6 = o pior caso do intervalo de 4–6 min), só das 08h às 18h
 * todo dia. Usado pra avisar quem não recebe antes da consulta e precisa de ligação. */
export function urgentSendTimes(count: number, now: Date, gapMin = 6): Date[] {
  const START = 8 * 60;
  const END = 18 * 60;
  const out: Date[] = [];
  let t = new Date(Math.ceil(now.getTime() / 60_000) * 60_000);
  for (let i = 0; i < count; i++) {
    const { minutes } = brParts(t);
    if (minutes < START) t = new Date(startOfBrazilDay(t).getTime() + START * 60_000);
    else if (minutes >= END) t = new Date(startOfBrazilDay(t).getTime() + 86_400_000 + START * 60_000);
    out.push(t);
    t = new Date(t.getTime() + gapMin * 60_000);
  }
  return out;
}

/** Aviso urgente: quem precisa de ligação — pendente que só receberia depois do horário
 * da consulta (pior caso, ver urgentSendTimes), já enviado depois desse horário, ou sem
 * horário de consulta (não dá pra garantir; a recepção confirma). `rows` na ordem da fila. */
export function patientsNeedingCall(
  rows: { id: string; status: string; dataIso: string; horario: string; sentAt: Date | null }[],
  now: Date
): { id: string; reason: "late" | "no_time" }[] {
  const pending = rows.filter((r) => r.status === "PENDING");
  const times = urgentSendTimes(pending.length, now);
  const sendOf = new Map(pending.map((r, i) => [r.id, times[i]]));
  const out: { id: string; reason: "late" | "no_time" }[] = [];
  for (const r of rows) {
    if (r.status !== "PENDING" && r.status !== "SENT") continue;
    if (!/^\d{2}:\d{2}/.test(r.horario)) {
      if (r.status === "PENDING") out.push({ id: r.id, reason: "no_time" });
      continue;
    }
    const deadline = new Date(`${r.dataIso}T${r.horario.slice(0, 5)}:00-03:00`);
    const at = r.status === "SENT" ? r.sentAt : sendOf.get(r.id);
    if (at && at > deadline) out.push({ id: r.id, reason: "late" });
  }
  return out;
}
