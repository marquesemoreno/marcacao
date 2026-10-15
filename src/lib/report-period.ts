/** Janelas de período do /clinic/relatorio e comparação com o período anterior
 * (crítica de design de Relatórios, out/2026: "sem veredito nem comparação"). */

/** Atual: desde o início (UTC) do dia `days` atrás, sem fim. Anterior: a janela de
 * mesmo tamanho imediatamente antes (`until` = início da atual). */
export function reportWindow(days: number, previous: boolean, now: Date = new Date()): { since: Date; until: Date | null } {
  const startOfToday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const currentSince = new Date(startOfToday - days * 86_400_000);
  if (!previous) return { since: currentSince, until: null };
  return { since: new Date(currentSince.getTime() - days * 86_400_000), until: currentSince };
}

/** Variação vs período anterior. "pts" = diferença em pontos (pra taxas em %); "%" =
 * variação relativa (pra contagens e tempos). `better` diz se subir é bom ou ruim. */
export function compareDelta(
  current: number | null,
  previous: number | null,
  unit: "pts" | "%",
  better: "up" | "down"
): { text: string; good: boolean | null } | null {
  if (current === null || previous === null) return null;
  if (unit === "%" && previous === 0) return null;
  const diff = unit === "pts" ? current - previous : ((current - previous) / previous) * 100;
  const rounded = Math.round(Math.abs(diff));
  if (rounded === 0) return { text: "= igual", good: null };
  const up = diff > 0;
  return { text: `${up ? "↑" : "↓"} ${rounded}${unit === "pts" ? " pts" : "%"}`, good: up === (better === "up") };
}

/** Período do relatório: janelas móveis (7/30/90 dias) ou mês-calendário (crítica de
 * Relatórios, 15/10: sem "este mês"/"mês passado" a gestora não fecha o mês). */
export type PeriodKey = "7" | "30" | "90" | "mes" | "mes-anterior";
export const PERIOD_KEYS: PeriodKey[] = ["7", "30", "90", "mes", "mes-anterior"];

/** `?periodo=` (novo) ou `?days=` (links antigos). Inválido → 30 dias. */
export function parsePeriodKey(periodo?: string, days?: string): PeriodKey {
  const v = periodo ?? days;
  return PERIOD_KEYS.includes(v as PeriodKey) ? (v as PeriodKey) : "30";
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const BRT_OFFSET_MS = 3 * 3_600_000; // Brasília (sem horário de verão)

/** 00:00 de Brasília do dia 1 do mês `monthOffset` meses a partir do mês atual (em Brasília). */
function monthStart(now: Date, monthOffset: number) {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + monthOffset, 1) + BRT_OFFSET_MS);
}
function monthName(now: Date, monthOffset: number) {
  const local = new Date(now.getTime() - BRT_OFFSET_MS);
  return MONTHS[(((local.getUTCMonth() + monthOffset) % 12) + 12) % 12];
}

/** Janela [since, until) do período; `previous` = a janela de comparação (mesmo tamanho
 * logo antes, ou o mês anterior). until null = até agora. */
export function periodWindow(key: PeriodKey, previous: boolean, now: Date = new Date()): { since: Date; until: Date | null } {
  if (key === "mes" || key === "mes-anterior") {
    const offset = (key === "mes" ? 0 : -1) - (previous ? 1 : 0);
    const until = offset === 0 ? null : monthStart(now, offset + 1);
    return { since: monthStart(now, offset), until };
  }
  return reportWindow(Number(key), previous, now);
}

/** Textos do período: `title` ("últimos 30 dias" / "outubro"), `compare` (com o que o
 * delta compara) e `short` (opção do seletor). */
export function periodLabels(key: PeriodKey, now: Date = new Date()) {
  if (key === "mes") return { title: `${monthName(now, 0)} (até hoje)`, compare: monthName(now, -1), short: "Este mês" };
  if (key === "mes-anterior") return { title: monthName(now, -1), compare: monthName(now, -2), short: "Mês passado" };
  return { title: `últimos ${key} dias`, compare: `${key} dias anteriores`, short: `Últimos ${key} dias` };
}
