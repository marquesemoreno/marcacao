/** Pausa dos lembretes D-1 da ponte por clínica (HospitalIntegration.remindersPausedUntil).
 * Uso típico: o WhatsApp restringiu o número por 24h e não pode abrir conversa nova
 * (Santa Clara, 16/11/2026). Ao vencer a data, os lembretes voltam sozinhos. */

export const REMINDER_PAUSE_OPTIONS = [1, 2, 7] as const;

export function reminderPauseUntil(days: number, now: Date = new Date()): Date {
  if (!(REMINDER_PAUSE_OPTIONS as readonly number[]).includes(days)) {
    throw new Error("Prazo de pausa inválido");
  }
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export function remindersPausedNow(pausedUntil: Date | null, now: Date = new Date()): boolean {
  return !!pausedUntil && pausedUntil > now;
}
