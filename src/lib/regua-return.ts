/** Quanto a régua de retorno/reativação trouxe de volta (roteiro 4.5): de quem recebeu o
 * passo, quantos responderam e quantos foram agendados (etapa Agendado ou finalizado como
 * agendamento) em até 30 dias depois do envio. */
export const REGUA_RETURN_WINDOW_DAYS = 30;
export const REGUA_RETURN_KINDS = ["RETORNO", "REATIVACAO"] as const;

type Sent = { phone: string; kind: string; sentAt: Date };
type Outcome = { phone: string; inboundAt: Date[]; scheduledAt: Date[] };

/** Chave do telefone sem o 9º dígito (celular BR), pra casar os dois formatos. */
function key(phone: string) {
  const p = phone.replace(/\D/g, "");
  return p.startsWith("55") && p.length === 13 && p[4] === "9" ? p.slice(0, 4) + p.slice(5) : p;
}

export function computeReguaReturn(sent: Sent[], outcomes: Outcome[], ticket: number | null) {
  const byPhone = new Map<string, { inbound: Date[]; scheduled: Date[] }>();
  for (const o of outcomes) {
    const k = key(o.phone);
    const cur = byPhone.get(k) ?? { inbound: [], scheduled: [] };
    cur.inbound.push(...o.inboundAt);
    cur.scheduled.push(...o.scheduledAt);
    byPhone.set(k, cur);
  }
  // Primeiro envio de cada paciente em cada passo.
  const first = new Map<string, Sent>();
  for (const s of sent) {
    const k = `${s.kind}|${key(s.phone)}`;
    const cur = first.get(k);
    if (!cur || s.sentAt < cur.sentAt) first.set(k, s);
  }
  const windowMs = REGUA_RETURN_WINDOW_DAYS * 86_400_000;
  const within = (dates: Date[], from: Date) => dates.some((x) => x > from && x.getTime() - from.getTime() <= windowMs);
  const rows: { kind: string; sent: number; replied: number; scheduled: number }[] = [];
  for (const s of first.values()) {
    let row = rows.find((r) => r.kind === s.kind);
    if (!row) rows.push((row = { kind: s.kind, sent: 0, replied: 0, scheduled: 0 }));
    row.sent++;
    const o = byPhone.get(key(s.phone));
    if (o && within(o.inbound, s.sentAt)) row.replied++;
    if (o && within(o.scheduled, s.sentAt)) row.scheduled++;
  }
  const totalSent = rows.reduce((a, r) => a + r.sent, 0);
  const totalScheduled = rows.reduce((a, r) => a + r.scheduled, 0);
  return { rows, totalSent, totalScheduled, estimatedRevenue: ticket && totalScheduled ? totalScheduled * ticket : null };
}
