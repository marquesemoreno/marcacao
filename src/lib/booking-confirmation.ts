/** Confirmação de agendamento ao paciente (Etapa 2.4, 07/11/2026). Agendamento pela ponte
 * (Santa Clara, Urolaser) só gravava uma nota interna — o paciente não recebia nada e a
 * recepção redigitava ~200x em 60 dias. Puro e testado. */
import { greetingFirstName, toTitleCaseName } from "./format";

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

function sentenceCase(s: string): string {
  const t = s.trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function doctorLine(doctor: string | null | undefined): string | null {
  const d = doctor?.trim();
  if (!d || /cl[ií]nica|conecta sa[uú]de/i.test(d)) return null;
  return /^dr/i.test(d) ? d : `Dr(a). ${toTitleCaseName(d)}`;
}

function dateLine(iso: string): string {
  const [y, m, day] = iso.slice(0, 10).split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  return `${WEEKDAYS[dow]}, ${String(day).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

function timeLine(time: string | null | undefined, arrivalOrder: boolean): string {
  const t = time?.trim();
  if (arrivalOrder) return t ? `A partir das ${t}, por ordem de chegada` : "Por ordem de chegada";
  return t || "Por ordem de chegada";
}

export function buildBookingConfirmation(input: {
  patientName: string;
  procedure: string;
  doctor?: string | null;
  /** YYYY-MM-DD */
  date: string;
  time?: string | null;
  arrivalOrder: boolean;
  price?: number | null;
  clinicName: string;
  address?: string | null;
  preparation?: string | null;
}): string {
  const first = /^\+?\d/.test(input.patientName.trim()) ? "" : greetingFirstName(input.patientName);
  const lines = [
    first ? `✅ Agendamento confirmado, ${first}!` : "✅ Agendamento confirmado!",
    "",
    `🩺 ${sentenceCase(input.procedure)}`,
  ];
  const doc = doctorLine(input.doctor);
  if (doc) lines.push(`👨‍⚕️ ${doc}`);
  lines.push(`📅 ${dateLine(input.date)}`, `⏰ ${timeLine(input.time, input.arrivalOrder)}`);
  if (input.price && input.price > 0) {
    lines.push(`💲 ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(input.price).replace(/ /g, " ")}`);
  }
  lines.push(`📍 ${input.clinicName}${input.address?.trim() ? ` — ${input.address.trim()}` : ""}`);
  if (input.preparation?.trim()) lines.push("", `📋 Preparo: ${input.preparation.trim()}`);
  lines.push("", "Se precisar remarcar, é só responder por aqui.");
  return lines.join("\n");
}
