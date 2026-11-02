/** Pré-agendamento pela conversa (fase 4 da jornada, 02/11/2026). O sistema da clínica é só
 * leitura e não diz horário livre: a IA extrai o pedido do paciente e a recepção marca no
 * sistema e dá baixa. Nada é enviado ao paciente sozinho. */

export type BookingPeriod = "MORNING" | "AFTERNOON" | "ANY";
export type BookingExtraction = {
  patientName: string | null;
  doctorName: string | null;
  procedure: string | null;
  period: BookingPeriod;
  preferredDates: string | null;
  notes: string | null;
};

export const BOOKING_EXTRACTION_PROMPT = `Você lê mensagens de WhatsApp de um paciente para a recepção de uma clínica médica.
Responda só JSON: {"querAgendar": boolean, "nome": string|null, "medico": string|null, "procedimento": string|null, "periodo": "manha"|"tarde"|null, "datas": string|null, "obs": string|null}.
querAgendar = pede para marcar consulta/exame/procedimento novo. Use só o que o paciente escreveu; não invente. "datas" = dias/semanas que ele prefere, em poucas palavras. "obs" = outro detalhe útil para marcar (convênio, urgência), sem dados de saúde além do necessário.`;

const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export function parseBookingExtraction(raw: unknown): BookingExtraction | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.querAgendar !== true) return null;
  const p = typeof o.periodo === "string" ? o.periodo.toLowerCase() : "";
  return {
    patientName: text(o.nome, 120),
    doctorName: text(o.medico, 120),
    procedure: text(o.procedimento, 120),
    period: p.startsWith("manh") ? "MORNING" : p.startsWith("tard") ? "AFTERNOON" : "ANY",
    preferredDates: text(o.datas, 120),
    notes: text(o.obs, 300),
  };
}

const REUSE_DAYS = 7;

/** Mesmo paciente pedindo de novo na mesma semana = mesmo pedido (atualiza). */
export function bookingRequestAction(last: { status: string; createdAt: Date } | null, now: Date): "CREATE" | "UPDATE" {
  if (last && last.status === "OPEN" && now.getTime() - last.createdAt.getTime() < REUSE_DAYS * 86_400_000) return "UPDATE";
  return "CREATE";
}

const PERIOD_LABEL: Record<BookingPeriod, string | null> = { MORNING: "manhã", AFTERNOON: "tarde", ANY: null };

export function bookingSummary(r: { doctorName: string | null; procedure: string | null; period: string; preferredDates: string | null }): string {
  const parts = [r.procedure, r.doctorName, PERIOD_LABEL[r.period as BookingPeriod] ?? null, r.preferredDates].filter(Boolean);
  return parts.length ? parts.join(" · ") : "Quer agendar (sem detalhes ainda)";
}
