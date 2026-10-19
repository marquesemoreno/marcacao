/** Horário marcado: a atendente digita o primeiro horário do dia e cada paciente seguinte do
 * mesmo médico entra 10 minutos depois do último (08:00 → 08:10 → 08:20…). Puro. */
export const SLOT_STEP_MINUTES = 10;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Próximo horário sugerido: o mais tarde já marcado + o passo. `null` se não há nenhuma
 * marcação com horário no dia (a atendente escolhe o primeiro) ou se passaria da meia-noite. */
export function nextSlotAfter(occupied: string[], stepMinutes: number = SLOT_STEP_MINUTES): string | null {
  let latest = -1;
  for (const raw of occupied) {
    const m = TIME.exec(raw.trim());
    if (!m) continue;
    latest = Math.max(latest, Number(m[1]) * 60 + Number(m[2]));
  }
  if (latest < 0) return null;
  const next = latest + stepMinutes;
  if (next >= 24 * 60) return null;
  return `${String(Math.floor(next / 60)).padStart(2, "0")}:${String(next % 60).padStart(2, "0")}`;
}
