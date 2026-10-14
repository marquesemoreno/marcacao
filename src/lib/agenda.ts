/** Agenda da recepção (/clinic/agenda): junta a agenda do sistema da clínica (ponte
 * Firebird, fonte de verdade da Urolaser/Santa Clara) com os agendamentos criados no
 * Conecta, e resolve um status único pra cada marcação. Puro — sem banco. */

export type AgendaStatus =
  | "PENDING" // sem lembrete ainda
  | "SENT" // lembrete enviado, aguardando resposta
  | "CONFIRMED"
  | "RESCHEDULE" // paciente pediu outra data
  | "IN_SERVICE" // presente / em atendimento (marcado pela recepção)
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

/** Status que a recepção pode marcar à mão (gravados em AgendaMark). */
export const MANUAL_AGENDA_STATUSES = ["CONFIRMED", "IN_SERVICE", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
export type ManualAgendaStatus = (typeof MANUAL_AGENDA_STATUSES)[number];

export type AgendaItem = {
  key: string;
  source: "BRIDGE" | "LOCAL";
  externalId: string;
  date: string; // AAAA-MM-DD
  time: string | null; // HH:MM; null = ordem de chegada
  patientName: string;
  phone: string | null;
  procedure: string | null;
  doctor: string | null;
  status: AgendaStatus;
  /** NUMERO da marcação no sistema da clínica — liga com lembrete e evita duplicar. */
  bridgeNumero: number | null;
};

export function resolveAgendaStatus(input: {
  manual?: string | null;
  local?: string | null;
  reminderResponse?: string | null;
  reminderSent?: boolean;
}): AgendaStatus {
  if (input.manual && (MANUAL_AGENDA_STATUSES as readonly string[]).includes(input.manual)) return input.manual as AgendaStatus;
  if (input.reminderResponse === "CONFIRMED") return "CONFIRMED";
  if (input.reminderResponse === "CANCELLED") return "CANCELLED";
  if (input.reminderResponse === "RESCHEDULE") return "RESCHEDULE";
  if (input.local === "CONFIRMED" || input.local === "COMPLETED" || input.local === "CANCELLED" || input.local === "NO_SHOW") {
    return input.local;
  }
  if (input.reminderSent) return "SENT";
  return "PENDING";
}

function sortKey(i: AgendaItem): string {
  return `${i.date} ${i.time ?? "99:99"}`;
}

/** Ponte + Conecta, sem duplicar (agendamento do Conecta que já foi pra ponte tem o
 * mesmo NUMERO) e em ordem de data/hora — sem hora (ordem de chegada) por último. */
export function mergeAgenda(bridge: AgendaItem[], local: AgendaItem[]): AgendaItem[] {
  const numeros = new Set(bridge.map((b) => b.bridgeNumero).filter((n): n is number => n != null));
  const onlyLocal = local.filter((l) => l.bridgeNumero == null || !numeros.has(l.bridgeNumero));
  return [...bridge, ...onlyLocal].sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
}

export const AGENDA_START_HOUR = 7;
export const AGENDA_END_HOUR = 19;
export const AGENDA_SLOT_MINUTES = 15;
export const AGENDA_ROWS = ((AGENDA_END_HOUR - AGENDA_START_HOUR) * 60) / AGENDA_SLOT_MINUTES;

/** Linha da grade (15 min a partir das 07:00) — null fora da grade ou sem hora. */
export function slotRowFor(time: string | null): number | null {
  if (!time) return null;
  const [h, m] = time.split(":").map(Number);
  const minutes = h * 60 + m - AGENDA_START_HOUR * 60;
  if (Number.isNaN(minutes) || minutes < 0 || minutes >= (AGENDA_END_HOUR - AGENDA_START_HOUR) * 60) return null;
  return Math.floor(minutes / AGENDA_SLOT_MINUTES);
}

export function rowToTime(row: number): string {
  const minutes = AGENDA_START_HOUR * 60 + row * AGENDA_SLOT_MINUTES;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function toDate(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}
function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toIso(d);
}

/** Segunda a sábado da semana da data (domingo conta na semana anterior). */
export function weekDays(iso: string): string[] {
  const d = toDate(iso);
  const monday = addDays(iso, -((d.getUTCDay() + 6) % 7));
  return Array.from({ length: 6 }, (_, i) => addDays(monday, i));
}

/** Dias da grade do mês: começa na segunda antes do dia 1 e fecha semanas inteiras. */
export function monthGridDays(iso: string): string[] {
  const first = `${iso.slice(0, 7)}-01`;
  const start = addDays(first, -((toDate(first).getUTCDay() + 6) % 7));
  const nextMonth = toDate(first);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const last = addDays(toIso(nextMonth), -1);
  const days: string[] = [];
  for (let d = start; d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  return days;
}

export const NO_DOCTOR = "Sem médico";

export function agendaDoctors(items: AgendaItem[]): string[] {
  const names = [...new Set(items.map((i) => i.doctor?.trim() || NO_DOCTOR))];
  return names.sort((a, b) => (a === NO_DOCTOR ? 1 : b === NO_DOCTOR ? -1 : a.localeCompare(b, "pt-BR")));
}
