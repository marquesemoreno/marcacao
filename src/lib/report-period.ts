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
