/** Ritmo único das mensagens automáticas de uma clínica (lembretes D-1 + campanhas de
 * marketing). Motivo: em 06/10/2026 a Meta restringiu o número da Urolaser — os 28
 * lembretes saíam numa rajada de 2 min às 09h, no mesmo minuto em que a campanha
 * começava. Agora: 4–6 min entre QUALQUER mensagem automática da clínica, e lembrete e
 * campanha se alternam (decisão do usuário: "vai intercalando"). */

const BRAZIL_OFFSET_MS = 3 * 3_600_000;
export const REMINDER_START_HOUR = 8;
export const REMINDER_END_HOUR = 18;

/** Lembretes D-1: 08:00–18:00 de Brasília, qualquer dia (a data-alvo é calculada à parte). */
export function isWithinReminderWindow(now: Date): boolean {
  const br = new Date(now.getTime() - BRAZIL_OFFSET_MS);
  const minutes = br.getUTCHours() * 60 + br.getUTCMinutes();
  return minutes >= REMINDER_START_HOUR * 60 && minutes < REMINDER_END_HOUR * 60;
}

/** Vez do lembrete? Só dentro do horário e depois do intervalo desde a última mensagem
 * automática (qualquer tipo). Se a última foi lembrete e há campanha pronta, a vez é da
 * campanha — assim os dois se intercalam em vez de um monopolizar. */
export function shouldSendReminder(input: {
  inWindow: boolean;
  gapElapsed: boolean;
  lastKind: "reminder" | "campaign" | null;
  campaignReady: boolean;
}): boolean {
  if (!input.inWindow || !input.gapElapsed) return false;
  if (input.lastKind === "reminder" && input.campaignReady) return false;
  return true;
}
