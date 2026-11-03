/** Lista de espera da agenda (/clinic/agenda): quando uma marcação é cancelada ou o
 * paciente falta, a vaga aparece com os candidatos da espera em ordem. Puro — sem banco. */

export const WAITLIST_PERIODS = ["ANY", "MORNING", "AFTERNOON"] as const;
export type WaitlistPeriod = (typeof WAITLIST_PERIODS)[number];
export const WAITLIST_PERIOD_LABEL: Record<WaitlistPeriod, string> = {
  ANY: "Qualquer horário",
  MORNING: "Manhã",
  AFTERNOON: "Tarde",
};

export type OpenSlot = { date: string; time: string; doctor: string | null; procedure: string | null };

export type WaitlistEntryLike = {
  id: string;
  patientName: string;
  phone: string;
  doctorName: string | null;
  period: string;
  status: string;
  createdAt: Date;
};

/** Cancelado/Faltou numa data e hora que ainda não passaram vira vaga. Sem horário (ordem
 * de chegada) não dá para oferecer. */
export function openSlotFromStatus(
  item: { status: string; date: string; time: string | null; doctor: string | null; procedure: string | null },
  now: { date: string; time: string }
): OpenSlot | null {
  if (item.status !== "CANCELLED" && item.status !== "NO_SHOW") return null;
  if (!item.time) return null;
  if (item.date < now.date) return null;
  if (item.date === now.date && item.time <= now.time) return null;
  return { date: item.date, time: item.time, doctor: item.doctor, procedure: item.procedure };
}

function periodOf(time: string): WaitlistPeriod {
  return time < "12:00" ? "MORNING" : "AFTERNOON";
}

function doctorKey(name: string | null | undefined) {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\bdr\(a\)|\bdra?\b|[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function phoneTail(phone: string) {
  return phone.replace(/\D/g, "").slice(-8);
}

/** Quem está aguardando e serve para a vaga: médico pedido (se houver) é o da vaga e o
 * período combina. Ordem: pediu esse médico → pediu esse período → espera há mais tempo. */
export function rankWaitlistCandidates<T extends WaitlistEntryLike>(
  entries: T[],
  slot: OpenSlot,
  options: { exceptPhone?: string | null } = {}
): T[] {
  const slotDoctor = doctorKey(slot.doctor);
  const slotPeriod = periodOf(slot.time);
  const except = options.exceptPhone ? phoneTail(options.exceptPhone) : null;

  return entries
    .filter((e) => e.status === "WAITING")
    .filter((e) => !except || phoneTail(e.phone) !== except)
    .filter((e) => !doctorKey(e.doctorName) || doctorKey(e.doctorName) === slotDoctor)
    .filter((e) => e.period === "ANY" || e.period === slotPeriod)
    .map((e) => ({ e, score: (doctorKey(e.doctorName) ? 2 : 0) + (e.period === slotPeriod ? 1 : 0) }))
    .sort((a, b) => b.score - a.score || a.e.createdAt.getTime() - b.e.createdAt.getTime())
    .map(({ e }) => e);
}

const WEEKDAYS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

export function buildSlotOfferMessage(slot: OpenSlot, patientName: string, clinicName: string): string {
  const [y, m, d] = slot.date.split("-").map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const dayMonth = `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
  const first = patientName.trim().split(/\s+/)[0] || "tudo bem";
  const withDoctor = slot.doctor ? ` com ${slot.doctor}` : "";
  return [
    `Olá, ${first}! 😊 Abriu uma vaga na ${clinicName}${withDoctor}: ${weekday}, ${dayMonth}, às ${slot.time}.`,
    "",
    "Você estava na nossa lista de espera. Ainda tem interesse? Responda esta mensagem que reservamos o horário pra você.",
  ].join("\n");
}

export type NormalizedWaitlistInput = {
  patientName: string;
  phone: string;
  doctorName: string | null;
  period: WaitlistPeriod;
  notes: string | null;
};

const clean = (v: string | null | undefined, max: number) => (v ?? "").trim().replace(/\s+/g, " ").slice(0, max).trim();

export function normalizeWaitlistInput(raw: {
  patientName: string;
  phone: string;
  doctorName?: string | null;
  period?: string | null;
  notes?: string | null;
}): { ok: true; value: NormalizedWaitlistInput } | { ok: false; error: string } {
  const patientName = clean(raw.patientName, 80);
  if (!patientName) return { ok: false, error: "Informe o nome do paciente." };
  const phone = raw.phone.replace(/\D/g, "");
  if (phone.length < 10 || phone.length > 13) return { ok: false, error: "Informe o WhatsApp com DDD." };
  const period = (raw.period ?? "ANY") as WaitlistPeriod;
  if (!(WAITLIST_PERIODS as readonly string[]).includes(period)) return { ok: false, error: "Período inválido." };
  return {
    ok: true,
    value: { patientName, phone, doctorName: clean(raw.doctorName, 80) || null, period, notes: clean(raw.notes, 200) || null },
  };
}

// ── Oferta automática (estilo Luma): vaga aberta vai sozinha pro 1º da espera; SIM fica com
// ela, NÃO ou sem resposta no prazo passa pro próximo. ────────────────────────────────────

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Resposta à oferta: "YES" / "NO" / null (outra coisa → fica pra recepção ler). */
export function parseOfferReply(text: string): "YES" | "NO" | null {
  const t = fold(text).replace(/[!.,]+$/g, "");
  if (!t) return null;
  if (/^(2|nao|n)\b/.test(t)) return "NO";
  if (/^(1|sim|s|quero|aceito|pode ser|pode|ok|claro|fico)\b/.test(t)) return "YES";
  return null;
}

/** Pode mandar a oferta agora? WAIT = fora de 07–20h (manda depois); TOO_LATE = vaga em menos de 1 h. */
export function canAutoOffer(slot: { date: string; time: string }, now: Date = new Date()): "SEND" | "WAIT" | "TOO_LATE" {
  const br = new Date(now.getTime() - 3 * 3600_000);
  const [h, m] = slot.time.split(":").map(Number);
  const slotMs = Date.parse(`${slot.date}T00:00:00Z`) + (h * 60 + m) * 60_000;
  if (slotMs - br.getTime() < 60 * 60_000) return "TOO_LATE";
  const hour = br.getUTCHours();
  return hour >= 7 && hour < 20 ? "SEND" : "WAIT";
}

export function buildAutoSlotOfferMessage(slot: OpenSlot, patientName: string, clinicName: string, minutes: number): string {
  const base = buildSlotOfferMessage(slot, patientName, clinicName).split("\n")[0];
  return [
    base,
    "",
    `Você estava na nossa lista de espera. Quer ficar com este horário? Responda *SIM* para reservar ou *NÃO* para liberar. A vaga fica guardada pra você por ${minutes} minutos.`,
  ].join("\n");
}
