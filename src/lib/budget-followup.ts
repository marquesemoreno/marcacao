/** Acompanhamento de orçamento (05/11/2026): conversa na etapa "Orçamento" entra numa fila
 * de cobrança em 3, 7 e 15 dias. A recepção revisa e envia com um clique — nada sai
 * sozinho pelo número não oficial (ver bloqueios de out/2026). Puro e testado. */

export const BUDGET_FOLLOWUP_DAYS = [3, 7, 15] as const;

/** Dia de calendário em Brasília (UTC-3, sem horário de verão). */
function brDay(d: Date): number {
  return Math.floor((d.getTime() - 3 * 3_600_000) / 86_400_000);
}

export function budgetFollowupDue(input: {
  sentAt: Date;
  /** Cobranças já enviadas desde que entrou em Orçamento. */
  done: number;
  lastFollowupAt?: Date | null;
  now: Date;
}): { step: number; daysSince: number } | null {
  const { sentAt, done, lastFollowupAt, now } = input;
  if (done >= BUDGET_FOLLOWUP_DAYS.length) return null;
  if (lastFollowupAt && brDay(lastFollowupAt) === brDay(now)) return null;
  const daysSince = brDay(now) - brDay(sentAt);
  if (daysSince < BUDGET_FOLLOWUP_DAYS[done]) return null;
  return { step: done + 1, daysSince };
}

function firstName(name: string): string {
  const first = name.trim().split(/\s+/)[0] ?? "";
  if (!first || /^\+?\d/.test(first)) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function budgetFollowupMessage(step: number, name: string): string {
  const n = firstName(name);
  const hi = n ? `Oi, ${n}!` : "Oi!";
  if (step <= 1)
    return `${hi} Tudo bem? Ficou alguma dúvida sobre o orçamento que enviamos? Posso te ajudar com as formas de pagamento ou já reservar um horário.`;
  if (step === 2)
    return `${hi} Passando para saber se você conseguiu analisar o orçamento. Se quiser, consigo reservar um horário para começarmos o tratamento.`;
  return `${hi} Seu orçamento continua disponível. Se algo te impediu de seguir (valor, prazo ou alguma dúvida), me conta que a gente procura a melhor solução para você.`;
}
