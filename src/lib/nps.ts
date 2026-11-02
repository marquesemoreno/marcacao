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
