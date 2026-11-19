/** Ocupação de consultórios e salas de exame (Relatório › Ocupação). A clínica não tem grade
 * de horário no sistema dela, então o horário de cada sala e a duração padrão de cada
 * marcação são cadastrados no Conecta (ClinicRoom). Puro — sem banco. */

import { isNationalHolidayYMD } from "./holidays";

export type RoomKind = "CONSULTORIO" | "PROCEDIMENTO";
export type RoomHours = { weekday: number; start: string; end: string };
export type RoomConfig = {
  id: string;
  name: string;
  kind: RoomKind;
  /** Faixas de funcionamento por dia da semana (0 = domingo). */
  hours: RoomHours[];
  /** Só sala de procedimento: marcação cujo procedimento contém uma destas palavras vai para ela. */
  procedureKeywords: string[];
  /** Duração padrão de cada marcação nesta sala. */
  slotMinutes: number;
};

export type OccupancyItem = { date: string; time: string | null; doctor: string | null; procedure: string | null; status: string };

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const toMin = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export const normalizeName = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** Lê o Json guardado no banco descartando faixas inválidas. */
export function parseRoomHours(raw: unknown): RoomHours[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((h) => {
    if (!h || typeof h !== "object") return [];
    const { weekday, start, end } = h as Record<string, unknown>;
    if (typeof weekday !== "number" || !Number.isInteger(weekday) || weekday < 0 || weekday > 6) return [];
    if (typeof start !== "string" || typeof end !== "string" || !HHMM.test(start) || !HHMM.test(end)) return [];
    if (toMin(end) <= toMin(start)) return [];
    return [{ weekday, start, end }];
  });
}

const weekdayOf = (ymd: string) => new Date(`${ymd}T12:00:00Z`).getUTCDay();
const isHoliday = (ymd: string) => isNationalHolidayYMD(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)), Number(ymd.slice(8, 10)));

/** Minutos em que a sala funciona nos dias do período (feriado nacional não conta). */
export function availableMinutes(room: RoomConfig, days: string[]): number {
  let total = 0;
  for (const d of days) {
    if (isHoliday(d)) continue;
    const wd = weekdayOf(d);
    for (const h of room.hours) if (h.weekday === wd) total += toMin(h.end) - toMin(h.start);
  }
  return total;
}

/** Sala da marcação: procedimento de sala de exames primeiro; senão a sala fixa do médico
 * (DoctorRoom, a mesma do painel da TV), casada pelo nome da sala. Null = sem sala. */
export function roomForItem(item: OccupancyItem, rooms: RoomConfig[], doctorRooms: Map<string, string>): RoomConfig | null {
  const proc = normalizeName(item.procedure ?? "");
  if (proc) {
    for (const r of rooms) {
      if (r.kind !== "PROCEDIMENTO") continue;
      if (r.procedureKeywords.some((k) => normalizeName(k) && proc.includes(normalizeName(k)))) return r;
    }
  }
  if (!item.doctor) return null;
  const roomName = doctorRooms.get(normalizeDoctor(item.doctor));
  if (!roomName) return null;
  const key = normalizeName(roomName);
  return rooms.find((r) => normalizeName(r.name) === key) ?? null;
}

/** Mesma chave do DoctorRoom.doctorKey (tv-call.ts), sem pontuação — "Dra. Ione" = "Dra Ione". */
export function normalizeDoctor(name: string): string {
  return normalizeName(name);
}

export type HeatCell = { bookedMin: number; availableMin: number };
export type RoomOccupancy = {
  id: string;
  name: string;
  kind: RoomKind;
  availableMin: number;
  /** Marcado, sem cancelados (faltas entram: o horário ficou reservado). */
  bookedMin: number;
  /** Faltas + cancelados. */
  lostMin: number;
  /** Marcado menos faltas. */
  effectiveMin: number;
  rate: number;
  effectiveRate: number;
  byDoctor: { doctor: string; bookedMin: number }[];
  /** [dia da semana 0–6][hora 0–23]. */
  heat: HeatCell[][];
};

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

export function computeOccupancy(
  items: OccupancyItem[],
  rooms: RoomConfig[],
  doctorRooms: Map<string, string>,
  days: string[]
): { rooms: RoomOccupancy[]; unassigned: { count: number; doctors: string[] } } {
  const workDays = days.filter((d) => !isHoliday(d));
  const result = new Map<string, RoomOccupancy & { doctorMap: Map<string, number> }>();
  for (const r of rooms) {
    const heat: HeatCell[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ bookedMin: 0, availableMin: 0 })));
    for (const d of workDays) {
      const wd = weekdayOf(d);
      for (const h of r.hours) {
        if (h.weekday !== wd) continue;
        for (let m = toMin(h.start); m < toMin(h.end); ) {
          const hour = Math.floor(m / 60);
          const next = Math.min((hour + 1) * 60, toMin(h.end));
          heat[wd][hour].availableMin += next - m;
          m = next;
        }
      }
    }
    result.set(r.id, {
      id: r.id, name: r.name, kind: r.kind,
      availableMin: availableMinutes(r, days),
      bookedMin: 0, lostMin: 0, effectiveMin: 0, rate: 0, effectiveRate: 0,
      byDoctor: [], heat, doctorMap: new Map(),
    });
  }

  const dayset = new Set(days);
  const unassignedDoctors = new Set<string>();
  let unassigned = 0;
  for (const it of items) {
    if (!dayset.has(it.date)) continue;
    const room = roomForItem(it, rooms, doctorRooms);
    if (!room) {
      if (it.status !== "CANCELLED") {
        unassigned++;
        if (it.doctor) unassignedDoctors.add(it.doctor);
      }
      continue;
    }
    const occ = result.get(room.id)!;
    const min = room.slotMinutes;
    if (it.status === "CANCELLED") {
      occ.lostMin += min;
      continue;
    }
    occ.bookedMin += min;
    if (it.status === "NO_SHOW") occ.lostMin += min;
    else occ.effectiveMin += min;
    if (it.doctor) occ.doctorMap.set(it.doctor, (occ.doctorMap.get(it.doctor) ?? 0) + min);
    if (it.time && HHMM.test(it.time)) occ.heat[weekdayOf(it.date)][Number(it.time.slice(0, 2))].bookedMin += min;
  }

  return {
    rooms: [...result.values()].map(({ doctorMap, ...o }) => ({
      ...o,
      rate: pct(o.bookedMin, o.availableMin),
      effectiveRate: pct(o.effectiveMin, o.availableMin),
      byDoctor: [...doctorMap].map(([doctor, bookedMin]) => ({ doctor, bookedMin })).sort((a, b) => b.bookedMin - a.bookedMin),
    })),
    unassigned: { count: unassigned, doctors: [...unassignedDoctors].sort() },
  };
}
