/** Pesquisa de satisfação (NPS) — nota 0–10 pelo link do passo "Satisfação" da régua.
 * Fase 4 da jornada do paciente (02/11/2026). */

export type NpsBucket = "PROMOTER" | "PASSIVE" | "DETRACTOR";

export function npsBucket(score: number): NpsBucket {
  return score >= 9 ? "PROMOTER" : score >= 7 ? "PASSIVE" : "DETRACTOR";
}

export function parseNpsScore(v: unknown): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

/** NPS = % promotores − % detratores (−100 a 100); null sem respostas. */
export function npsSummary(scores: number[]) {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  for (const s of scores) {
    const b = npsBucket(s);
    if (b === "PROMOTER") promoters++;
    else if (b === "PASSIVE") passives++;
    else detractors++;
  }
  const total = scores.length;
  const nps = total ? Math.round(((promoters - detractors) / total) * 100) : null;
  return { total, promoters, passives, detractors, nps };
}

/** Link de avaliação no Google digitado em Configurações. Só https e com domínio de verdade;
 * "g.page/…" colado sem protocolo vira https. Inválido = null. */
export function normalizeReviewUrl(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  const withProto = /^https?:\/\//i.test(s) ? s.replace(/^http:/i, "https:") : /^[a-z]+:/i.test(s) ? null : `https://${s}`;
  if (!withProto) return null;
  try {
    const u = new URL(withProto);
    if (u.protocol !== "https:" || !u.hostname.includes(".") || /\s/.test(s)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

/** Passo 4.4 do roteiro: promotor (9–10) é convidado a avaliar no Google. */
export function reviewLinkFor(score: number, url: string | null | undefined): string | null {
  return npsBucket(score) === "PROMOTER" ? normalizeReviewUrl(url) : null;
}
