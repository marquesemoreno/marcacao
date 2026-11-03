/** Senhas do totem (retirar senha → fila → chamada na TV) — funções puras.
 * N = normal, P = preferencial (Lei 10.048: idoso, gestante, PcD…), que passa na frente. */

export type TicketType = "N" | "P";
export type TicketStatus = "WAITING" | "CALLED" | "DONE" | "NO_SHOW" | "CANCELLED";
export type QueueTicketLite = { id: string; type: TicketType; status: TicketStatus; createdAt: Date };

/** Série da senha: com serviço, letra dele (+ "P" na preferencial: C / CP); sem serviço, N / P. */
export function seriesFor(letter: string | null | undefined, type: TicketType): string {
  return letter ? `${letter}${type === "P" ? "P" : ""}` : type;
}

export function ticketCode(series: string, number: number): string {
  return `${series}${String(number).padStart(3, "0")}`;
}

/** O que a voz da TV fala: "Senha N, 7" / "Senha preferencial P, 12" / "Senha preferencial C, 12" (CP012). */
export function ticketSpoken(code: string): string {
  const m = code.match(/^([A-Z]+)(\d+)$/);
  if (!m) return `Senha ${code}`;
  const [, series, num] = m;
  const pref = series === "P" || (series.length === 2 && series.endsWith("P"));
  const letter = series.length === 2 ? series[0] : series;
  return `Senha ${pref ? "preferencial " : ""}${letter}, ${Number(num)}`;
}

/** Cadastro de serviço da senha (Consulta, Exame…). N e P são da senha sem serviço. */
export function normalizeServiceInput(raw: { name: string; letter: string }): { ok: true; value: { name: string; letter: string } } | { ok: false; error: string } {
  const name = raw.name.trim().replace(/\s+/g, " ").slice(0, 30);
  const letter = raw.letter.trim().toUpperCase();
  if (!name) return { ok: false, error: "Informe o nome do serviço." };
  if (!/^[A-Z]$/.test(letter)) return { ok: false, error: "A letra precisa ser uma única letra (A–Z)." };
  if (letter === "N" || letter === "P") return { ok: false, error: "N e P já são usadas (normal/preferencial). Escolha outra letra." };
  return { ok: true, value: { name, letter } };
}

const byAge = (a: QueueTicketLite, b: QueueTicketLite) => a.createdAt.getTime() - b.createdAt.getTime();

/** Próxima a chamar: a preferencial mais antiga; sem preferencial, a normal mais antiga. */
export function nextTicket<T extends QueueTicketLite>(tickets: T[]): T | null {
  const waiting = tickets.filter((t) => t.status === "WAITING").sort(byAge);
  return waiting.find((t) => t.type === "P") ?? waiting[0] ?? null;
}

/** Quantas senhas serão chamadas antes desta (pela regra do nextTicket). */
export function ticketsAhead(tickets: QueueTicketLite[], id: string): number {
  const me = tickets.find((t) => t.id === id);
  if (!me || me.status !== "WAITING") return 0;
  return tickets.filter(
    (t) =>
      t.id !== me.id &&
      t.status === "WAITING" &&
      (me.type === "P" ? t.type === "P" && byAge(t, me) < 0 : t.type === "P" || byAge(t, me) < 0),
  ).length;
}

/** Últimos 8 dígitos do telefone — casa com/sem DDI, DDD e 9º dígito. */
export function phoneTail(phone: string | null | undefined): string | null {
  const d = (phone ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : null;
}

const CLOSED = new Set(["COMPLETED", "CANCELLED", "NO_SHOW"]);

/** Consulta de hoje do paciente que tirou a senha: pelo telefone (ou telefones do cadastro,
 * quando digitou CPF). Ignora atendidas/canceladas/faltas; com mais de uma, a mais cedo. */
export function matchTicketAppointment<T extends { phone: string | null; time: string | null; status: string }>(
  items: T[],
  phones: string[],
): T | null {
  const tails = new Set(phones.map(phoneTail).filter((x): x is string => !!x));
  if (tails.size === 0) return null;
  const hits = items
    .filter((i) => !CLOSED.has(i.status))
    .filter((i) => {
      const tail = phoneTail(i.phone);
      return !!tail && tails.has(tail);
    })
    .sort((a, b) => (a.time ?? "99:99").localeCompare(b.time ?? "99:99"));
  return hits[0] ?? null;
}

const docKey = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\bdra?\b|[.]/g, " ").replace(/\s+/g, " ").trim();

/** Atraso do médico (estimado): quanto o primeiro paciente dele ainda esperando já passou do
 * horário marcado. null = senha sem médico ou ninguém dele com horário na fila. */
export function doctorDelayMin(
  tickets: { doctor: string | null; appointmentTime: string | null; status: string }[],
  doctor: string | null,
  nowMinutes: number,
): number | null {
  if (!doctor) return null;
  const k = docKey(doctor);
  const times = tickets
    .filter((t) => t.status === "WAITING" && t.doctor && docKey(t.doctor) === k && t.appointmentTime)
    .map((t) => {
      const [h, m] = t.appointmentTime!.split(":").map(Number);
      return h * 60 + m;
    });
  if (times.length === 0) return null;
  return Math.max(0, nowMinutes - Math.min(...times));
}
