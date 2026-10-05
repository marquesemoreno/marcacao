/** Regras de ritmo das campanhas de marketing (todo disparo em massa que não é o aviso de
 * remarcação) — pra não queimar o número da clínica no WhatsApp. Aviso de remarcação NÃO passa por
 * aqui: é urgente e sai a qualquer hora. Brasil sem horário de verão: offset fixo -3h. */
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
