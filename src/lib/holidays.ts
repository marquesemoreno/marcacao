/** Feriados nacionais (fixos + Sexta-feira Santa) — usados pelo lembrete D-1
 * (nextReminderTargetDate) e pela previsão de término das campanhas. */

/** Feriados nacionais fixos (MM-DD). */
const FIXED_HOLIDAYS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

/** Domingo de Páscoa (algoritmo de Meeus/Butcher) — base da Sexta-feira Santa. Mês 1–12. */
function easterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  return { month: Math.floor((h + l - 7 * m + 114) / 31), day: ((h + l - 7 * m + 114) % 31) + 1 };
}

/** month = 1–12. */
export function isNationalHolidayYMD(year: number, month: number, day: number): boolean {
  const mmdd = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  if (FIXED_HOLIDAYS.includes(mmdd)) return true;
  const easter = easterSunday(year);
  const goodFriday = new Date(Date.UTC(year, easter.month - 1, easter.day - 2));
  return goodFriday.getUTCMonth() + 1 === month && goodFriday.getUTCDate() === day;
}
