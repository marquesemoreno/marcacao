/** Senhas do totem (retirar senha → fila → chamada na TV) — funções puras.
 * N = normal, P = preferencial (Lei 10.048: idoso, gestante, PcD…), que passa na frente. */

export type TicketType = "N" | "P";
export type TicketStatus = "WAITING" | "CALLED" | "DONE" | "NO_SHOW" | "CANCELLED";
export type QueueTicketLite = { id: string; type: TicketType; status: TicketStatus; createdAt: Date };

export function ticketCode(type: TicketType, number: number): string {
  return `${type}${String(number).padStart(3, "0")}`;
}

/** O que a voz da TV fala: "Senha N, 7" / "Senha preferencial P, 12". */
export function ticketSpoken(code: string): string {
  const type = code.charAt(0);
  const n = Number(code.slice(1));
  return `Senha ${type === "P" ? "preferencial " : ""}${type}, ${n}`;
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
