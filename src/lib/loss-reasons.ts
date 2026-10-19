/** Motivos de perda do CRM ("por que não fechou"). Os padrões valem para todas as clínicas;
 * cada clínica pode acrescentar os dela (tabela LossReason). */
export const DEFAULT_LOSS_REASONS = [
  { id: "PERDA_PRECO", label: "Preço" },
  { id: "PERDA_CONVENIO", label: "Convênio não atendido" },
  { id: "PERDA_HORARIO", label: "Horário / agenda" },
  { id: "PERDA_OUTRO", label: "Outro motivo" },
] as const;

export const LOSS_REASON_MAX_LENGTH = 40;
const CUSTOM_PREFIX = "PERDA_CUSTOM:";

export function normalizeLossReasonLabel(raw: string): string | null {
  const label = raw.trim().replace(/\s+/g, " ").slice(0, LOSS_REASON_MAX_LENGTH).trim();
  return label || null;
}

/** O id guarda o próprio rótulo: Conversation.resolutionReason continua legível nos
 * relatórios e na ficha do paciente mesmo se a clínica remover o motivo depois. */
export function customLossReasonId(label: string) {
  return `${CUSTOM_PREFIX}${label}`;
}

export function customLossReasonLabel(reason: string): string | null {
  return reason.startsWith(CUSTOM_PREFIX) ? reason.slice(CUSTOM_PREFIX.length) || null : null;
}

function comparable(label: string) {
  return label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Padrões (menos "Outro motivo") + os da clínica + "Outro motivo" por último. Motivo que
 * repete um padrão ou outro da própria clínica (sem diferenciar caixa/acento) é ignorado. */
export function resolveLossReasons(customLabels: string[]): { id: string; label: string }[] {
  const [other] = DEFAULT_LOSS_REASONS.filter((r) => r.id === "PERDA_OUTRO");
  const defaults = DEFAULT_LOSS_REASONS.filter((r) => r.id !== "PERDA_OUTRO").map((r) => ({ id: r.id as string, label: r.label as string }));
  const seen = new Set([...defaults, other].map((r) => comparable(r.label)));
  const custom: { id: string; label: string }[] = [];
  for (const raw of customLabels) {
    const label = normalizeLossReasonLabel(raw);
    if (!label || seen.has(comparable(label))) continue;
    seen.add(comparable(label));
    custom.push({ id: customLossReasonId(label), label });
  }
  return [...defaults, ...custom, { id: other.id as string, label: other.label as string }];
}
