/** Pedido de marcação fora do horário (06/11/2026). O sistema da clínica é só leitura e não
 * diz horário livre, então a IA não marca: com a clínica fechada, conversa com o paciente
 * até o pedido ficar completo (o quê + quando) e avisa quando a recepção confirma. O pedido
 * vai para "Pedidos de marcação" da Agenda. Puro e testado. */
import { isNationalHolidayYMD } from "./holidays";

type Day = { open?: string; close?: string; closed?: boolean };
type Hours = Record<string, Day> | null | undefined;

const DEFAULT: Record<string, Day> = {
  seg: { open: "08:00", close: "18:00" },
  ter: { open: "08:00", close: "18:00" },
  qua: { open: "08:00", close: "18:00" },
  qui: { open: "08:00", close: "18:00" },
  sex: { open: "08:00", close: "18:00" },
  sab: { open: "08:00", close: "12:00" },
  dom: { closed: true },
};
const KEYS = ["dom", "seg", "ter", "qua", "qui", "sex", "sab"];
const NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export const AFTER_HOURS_MAX_REPLIES = 3;

/** Data/hora de Brasília (UTC-3) como campos UTC de um Date deslocado. */
function brParts(d: Date) {
  const b = new Date(d.getTime() - 3 * 3_600_000);
  return {
    y: b.getUTCFullYear(),
    m: b.getUTCMonth() + 1,
    day: b.getUTCDate(),
    dow: b.getUTCDay(),
    hm: `${String(b.getUTCHours()).padStart(2, "0")}:${String(b.getUTCMinutes()).padStart(2, "0")}`,
  };
}

function dayConfig(hours: Hours, dow: number, y: number, m: number, d: number): Day | null {
  if (isNationalHolidayYMD(y, m, d)) return null;
  const map = hours && typeof hours === "object" && Object.keys(hours).length ? hours : DEFAULT;
  const c = map[KEYS[dow]] ?? DEFAULT[KEYS[dow]];
  if (!c || c.closed || !c.open || !c.close) return null;
  return c;
}

export function isClinicOpenAt(hours: Hours, now: Date): boolean {
  const p = brParts(now);
  const c = dayConfig(hours, p.dow, p.y, p.m, p.day);
  return !!c && p.hm >= c.open! && p.hm < c.close!;
}

/** "amanhã a partir das 08:00", "hoje a partir das 08:00", "segunda-feira a partir das 08:00". */
export function nextOpening(hours: Hours, now: Date): string {
  const p = brParts(now);
  for (let i = 0; i < 14; i++) {
    const d = brParts(new Date(now.getTime() + i * 86_400_000));
    const c = dayConfig(hours, d.dow, d.y, d.m, d.day);
    if (!c) continue;
    if (i === 0 && p.hm >= c.open!) continue;
    const when = i === 0 ? "hoje" : i === 1 ? "amanhã" : NAMES[d.dow];
    return `${when} a partir das ${c.open}`;
  }
  return "no próximo dia útil";
}

export type BookingFields = {
  procedure: string | null;
  doctorName: string | null;
  period: string;
  preferredDates: string | null;
};

export function missingBookingField(r: BookingFields): "O_QUE" | "QUANDO" | null {
  if (!r.procedure && !r.doctorName) return "O_QUE";
  if (r.period === "ANY" && !r.preferredDates) return "QUANDO";
  return null;
}

function firstName(name: string): string {
  const f = name.trim().split(/\s+/)[0] ?? "";
  if (!f || /^\+?\d/.test(f)) return "";
  return f.charAt(0).toUpperCase() + f.slice(1).toLowerCase();
}

export function afterHoursBookingReply(input: {
  missing: "O_QUE" | "QUANDO" | null;
  name: string;
  opening: string;
  summary?: string;
  /** "open" = horário comercial, recepção ocupada (nível 1 do 4.1). */
  mode?: "closed" | "open";
}): string {
  const n = firstName(input.name);
  const hi = n ? `Oi, ${n}!` : "Oi!";
  if (input.mode === "open") {
    if (input.missing === "O_QUE")
      return `${hi} Nossa recepção está terminando outro atendimento, então já vou adiantando seu pedido de marcação. É consulta ou exame? Se tiver preferência de médico, me diga também.`;
    if (input.missing === "QUANDO") return `${hi} Anotado. Você prefere manhã ou tarde? E tem algum dia da semana melhor para você?`;
    return `Pronto${n ? `, ${n}` : ""}! Seu pedido ficou assim: ${input.summary ?? "marcação"}. A recepção confirma o horário com você em instantes. Se quiser acrescentar algo (convênio, por exemplo), é só mandar aqui.`;
  }
  if (input.missing === "O_QUE")
    return `${hi} Nossa recepção está fechada agora, mas já vou deixar seu pedido de marcação pronto. É consulta ou exame? Se tiver preferência de médico, me diga também.`;
  if (input.missing === "QUANDO")
    return `${hi} Anotado. Você prefere manhã ou tarde? E tem algum dia da semana melhor para você?`;
  return `Pronto${n ? `, ${n}` : ""}! Seu pedido ficou assim: ${input.summary ?? "marcação"}. A recepção confirma o horário com você ${input.opening}. Se quiser acrescentar algo (convênio, por exemplo), é só mandar aqui.`;
}

/** Horário comercial: a IA só entra se o pedido de marcação ficou BOOKING_ASSIST_WAIT_MIN sem
 * ninguém da equipe responder (recepção ocupada). Mais de 2h parado é pendência da recepção. */
export const BOOKING_ASSIST_WAIT_MIN = 5;
const BOOKING_ASSIST_MAX_MIN = 120;

export function shouldAssistDuringHours(input: {
  minutesSinceLastInbound: number;
  lastDirection: "INBOUND" | "OUTBOUND" | null;
  humanReplied: boolean;
}): boolean {
  if (input.lastDirection !== "INBOUND" || input.humanReplied) return false;
  return input.minutesSinceLastInbound >= BOOKING_ASSIST_WAIT_MIN && input.minutesSinceLastInbound <= BOOKING_ASSIST_MAX_MIN;
}
