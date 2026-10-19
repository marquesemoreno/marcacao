/** Histórico das ações da IA (tela /clinic/ia): o que ela decidiu ou respondeu sozinha, com
 * a mensagem do paciente que motivou. Puro — a gravação fica no webhook. */

export type AiActionRecord = {
  id: string;
  kind: string;
  summary: string;
  confidence: number | null;
  conversationId: string;
  patientName: string;
  createdAt: Date;
};

export type AiActionGroup = "decisao" | "atendimento";
export type AiActionTone = "positive" | "neutral" | "attention";

const KINDS: Record<string, { label: string; group: AiActionGroup; tone: AiActionTone; quote: boolean }> = {
  APPT_CONFIRMED: { label: "Confirmou a consulta", group: "decisao", tone: "positive", quote: true },
  APPT_CANCELLED: { label: "Cancelou a consulta", group: "decisao", tone: "attention", quote: true },
  APPT_RESCHEDULE: { label: "Registrou pedido de remarcação", group: "decisao", tone: "neutral", quote: true },
  AI_REPLIED: { label: "Respondeu o paciente", group: "atendimento", tone: "neutral", quote: true },
  AI_ESCALATED: { label: "Passou para a equipe", group: "atendimento", tone: "attention", quote: false },
};

const MAX_SUMMARY = 100;

export function describeAiAction(record: AiActionRecord) {
  const meta = KINDS[record.kind] ?? { label: "Ação da IA", group: "atendimento" as const, tone: "neutral" as const, quote: false };
  const text = record.summary.length > MAX_SUMMARY ? `${record.summary.slice(0, MAX_SUMMARY).trimEnd()}…` : record.summary;
  const parts = [meta.quote ? `“${text}”` : text];
  if (record.confidence !== null) parts.push(`confiança ${Math.round(record.confidence * 100)}%`);
  return { label: meta.label, group: meta.group, tone: meta.tone, detail: parts.join(" · ") };
}

function plain(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function filterAiActions(
  list: AiActionRecord[],
  filter: { group?: AiActionGroup; query?: string; since?: Date }
): AiActionRecord[] {
  const q = filter.query ? plain(filter.query.trim()) : "";
  return list
    .filter((r) => !filter.group || describeAiAction(r).group === filter.group)
    .filter((r) => !q || plain(r.patientName).includes(q))
    .filter((r) => !filter.since || r.createdAt >= filter.since)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
