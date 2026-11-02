/** Agenda da recepção (/clinic/agenda): junta a agenda do sistema da clínica (ponte
 * Firebird, fonte de verdade da Urolaser/Santa Clara) com os agendamentos criados no
 * Conecta, e resolve um status único pra cada marcação. Puro — sem banco. */

export type AgendaStatus =
  | "PENDING" // sem lembrete ainda
  | "SENT" // lembrete enviado, aguardando resposta
  | "CONFIRMED"
  | "RESCHEDULE" // paciente pediu outra data
  | "IN_SERVICE" // chegou, aguardando na recepção
  | "IN_ROOM" // chamado — em atendimento com o médico
  | "COMPLETED"
  | "CANCELLED"
  | "NO_SHOW";

/** Status que a recepção pode marcar à mão (gravados em AgendaMark). */
export const MANUAL_AGENDA_STATUSES = ["CONFIRMED", "IN_SERVICE", "IN_ROOM", "COMPLETED", "NO_SHOW", "CANCELLED"] as const;
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
  /** Status veio de marcação manual da recepção (dá pra "voltar ao automático"). */
  isManual?: boolean;
  /** ISO de quando a recepção marcou "Chegou" (IN_SERVICE) — base da fila de chegada. */
  arrivedAt?: string;
  /** Paciente já enviou a ficha prévia pelo link do lembrete. */
  formDone?: boolean;
};

/** O que a recepção pode escolher no card: um status manual ou voltar ao automático. */
export type AgendaStatusChoice = ManualAgendaStatus | "AUTO";

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

export type DaySummary = {
  total: number;
  confirmado: number;
  aguardando: number;
  remarcar: number;
  atendimento: number;
  presente: number;
  atendido: number;
  falta: number;
};

/** Contagem do dia pra faixa de resumo da Agenda. "Quer remarcar" fica separado de
 * "aguardando" porque é o único status que pede ação da recepção. */
export function daySummary(items: AgendaItem[]): DaySummary {
  const s: DaySummary = { total: items.length, confirmado: 0, aguardando: 0, remarcar: 0, presente: 0, atendimento: 0, atendido: 0, falta: 0 };
  for (const i of items) {
    if (i.status === "CONFIRMED") s.confirmado++;
    else if (i.status === "PENDING" || i.status === "SENT") s.aguardando++;
    else if (i.status === "RESCHEDULE") s.remarcar++;
    else if (i.status === "IN_SERVICE") s.presente++;
    else if (i.status === "IN_ROOM") s.atendimento++;
    else if (i.status === "COMPLETED") s.atendido++;
    else s.falta++;
  }
  return s;
}

/** Linhas da grade que valem mostrar: do primeiro ao último paciente (com 1 linha de
 * folga), incluindo a hora atual se for hoje. Sem ninguém: horário comercial 08–18h. */
export function visibleRowRange(items: AgendaItem[], nowTime?: string | null): [number, number] {
  const rows = items.map((i) => slotRowFor(i.time)).filter((r): r is number => r != null);
  const now = slotRowFor(nowTime ?? null);
  if (now != null) rows.push(now);
  if (rows.length === 0) return [slotRowFor("08:00")!, slotRowFor("17:45")!];
  return [Math.max(0, Math.min(...rows) - 1), Math.min(AGENDA_ROWS - 1, Math.max(...rows) + 1)];
}

export type ArrivalEntry = {
  item: AgendaItem;
  position: number;
  waitingMin: number;
  /** Minutos além do horário marcado (0 = ainda não passou). null = ordem de chegada, sem horário. */
  lateMin: number | null;
};

/** Agora em minutos do dia no horário de Brasília (UTC−3). */
function minutesOfDayBR(d: Date): number {
  return (((d.getUTCHours() - 3 + 24) % 24) * 60) + d.getUTCMinutes();
}

/** Fila de chegada do dia: quem a recepção marcou "Chegou" (IN_SERVICE), em ordem de
 * chegada, com minutos de espera e posição na fila do próprio médico. */
export function arrivalQueue(items: AgendaItem[], date: string, now: Date = new Date()): ArrivalEntry[] {
  const waiting = items
    .filter((i) => i.date === date && i.status === "IN_SERVICE" && i.arrivedAt)
    // Agrupado por médico (crítica 02/11, 5ª: "1º da fila" aparecia duas vezes misturado),
    // médico de quem chegou primeiro em cima; dentro do grupo, ordem de chegada.
    .sort((a, b) => a.arrivedAt!.localeCompare(b.arrivedAt!));
  const docOf = (i: AgendaItem) => i.doctor?.trim() || NO_DOCTOR;
  const firstArrival = new Map<string, number>();
  waiting.forEach((i, idx) => {
    if (!firstArrival.has(docOf(i))) firstArrival.set(docOf(i), idx);
  });
  waiting.sort((a, b) => firstArrival.get(docOf(a))! - firstArrival.get(docOf(b))! || a.arrivedAt!.localeCompare(b.arrivedAt!));
  const perDoctor = new Map<string, number>();
  return waiting.map((item) => {
    const doctor = item.doctor?.trim() || NO_DOCTOR;
    const position = (perDoctor.get(doctor) ?? 0) + 1;
    perDoctor.set(doctor, position);
    const waitingMin = Math.max(0, Math.round((now.getTime() - new Date(item.arrivedAt!).getTime()) / 60_000));
    // Crítica 02/11: "atrasado" contava da chegada — quem chegou 1 h adiantado ficava vermelho.
    let lateMin: number | null = null;
    if (item.time) {
      const [h, m] = item.time.split(":").map(Number);
      lateMin = Math.max(0, minutesOfDayBR(now) - (h * 60 + m));
    }
    return { item, position, waitingMin, lateMin };
  });
}

/** Cancelamentos feitos só no Conecta que ainda precisam ser feitos no sistema da clínica.
 * A marcação continua vindo pela ponte enquanto não for cancelada lá — quando a recepção
 * cancela no sistema, ela some da ponte e sai desta lista sozinha. */
export function systemPendings(items: AgendaItem[], today: string): AgendaItem[] {
  // Falta também (decisão 02/11): o sistema da clínica precisa registrar. Ela pode continuar
  // vindo pela ponte depois de ajustada, então a recepção marca "Feito" (ver SystemPendings).
  const weekAgo = addDays(today, -7);
  return items
    .filter(
      (i) =>
        i.source === "BRIDGE" &&
        i.isManual &&
        ((i.status === "CANCELLED" && i.date >= today) || (i.status === "NO_SHOW" && i.date >= weekAgo && i.date <= today))
    )
    .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")));
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Busca de paciente na Agenda: nome sem acento ou pedaço do telefone (só dígitos, ≥3). */
export function matchesPatientQuery(item: AgendaItem, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (fold(item.patientName).includes(fold(q))) return true;
  const digits = q.replace(/\D/g, "");
  return digits.length >= 3 && !!item.phone && item.phone.replace(/\D/g, "").includes(digits);
}

/** Tolerância antes de considerar "já devia ter chegado". */
export const OVERDUE_GRACE_MIN = 15;

/** Hoje, com horário marcado, ainda aguardando (sem "Chegou") e passado da tolerância:
 * minutos de atraso. Senão null. Crítica 02/11 (4ª): confirmado que não veio parecia igual
 * a quem é mais tarde. */
export function overdueMinutes(item: AgendaItem, today: string, nowHHMM: string): number | null {
  if (item.date !== today || !item.time) return null;
  if (!["PENDING", "SENT", "CONFIRMED"].includes(item.status)) return null;
  const toMin = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const late = toMin(nowHHMM) - toMin(item.time);
  return late > OVERDUE_GRACE_MIN ? late : null;
}

export type GridSegment = { type: "row"; row: number } | { type: "gap"; from: number; to: number };

/** Linhas de 15 min sem ninguém, 4 ou mais seguidas (1 h), viram uma faixa "livre" na
 * grade (crítica 02/11, 6ª: ~25 linhas vazias empurravam a tarde pra fora da tela).
 * `keep` = linhas que sempre aparecem ("agora"); `opened` = início de faixas que a recepção
 * abriu pra marcar. */
export function collapseEmptyRows(rows: number[], occupied: Set<number>, keep: Set<number> = new Set(), opened: Set<number> = new Set()): GridSegment[] {
  const out: GridSegment[] = [];
  let i = 0;
  while (i < rows.length) {
    const r = rows[i];
    if (occupied.has(r) || keep.has(r)) {
      out.push({ type: "row", row: r });
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < rows.length && !occupied.has(rows[j + 1]) && !keep.has(rows[j + 1])) j++;
    const run = rows.slice(i, j + 1);
    if (run.length >= 4 && !opened.has(run[0])) out.push({ type: "gap", from: run[0], to: run[run.length - 1] });
    else for (const x of run) out.push({ type: "row", row: x });
    i = j + 1;
  }
  return out;
}

/** "CONSULTA EM CONSULTORIO (NO HORARIO NORMAL OU PREESTABELECIDO)" → "CONSULTA EM
 * CONSULTORIO": o parêntese do sistema da clínica vai pro tooltip. */
export function shortProcedure(name: string | null | undefined): string | null {
  const t = name?.trim();
  if (!t) return null;
  const short = t.replace(/\s*\([^)]*\)\s*/g, " ").replace(/\s+/g, " ").trim();
  return short || t;
}
