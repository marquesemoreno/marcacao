/** Tempo médio que a recepção levaria para digitar/enviar cada mensagem automática. */
export const SECONDS_PER_MESSAGE = 45;

export type HoursSavedCategory =
  | "lembrete"
  | "resposta_lembrete"
  | "encerramento"
  | "boas_vindas"
  | "endereco"
  | "confirmacao"
  | "remarcacao"
  | "outras";

export const HOURS_SAVED_LABELS: Record<HoursSavedCategory, string> = {
  lembrete: "Lembretes de consulta",
  resposta_lembrete: "Respostas aos lembretes",
  encerramento: "Avisos de encerramento",
  boas_vindas: "Boas-vindas",
  endereco: "Endereço automático",
  confirmacao: "Confirmações de agendamento",
  remarcacao: "Avisos de remarcação",
  outras: "Outras automáticas",
};

export function classifyAutomaticMessage(content: string | null | undefined): HoursSavedCategory {
  const t = (content ?? "").toLowerCase();
  if (!t) return "outras";
  if (t.startsWith("📍 nosso endereço")) return "endereco";
  if (t.includes("agendamento confirmado") || t.includes("agendamento foi realizado")) return "confirmacao";
  if (t.includes("agendamento foi remarcado") || t.includes("foi remarcad")) return "remarcacao";
  if (t.includes("vamos finalizar este atendimento")) return "encerramento";
  if (t.startsWith("agradecemos a confirmação") || t.startsWith("entendido")) return "resposta_lembrete";
  if (t.includes("lembrando") || t.includes("eu sou a lara")) return "lembrete";
  if (t.includes("bem-vindo") || t.includes("bem-vinda")) return "boas_vindas";
  return "outras";
}

export type HoursSavedSummary = {
  totalMessages: number;
  totalHours: number;
  categories: { key: HoursSavedCategory; label: string; count: number; hours: number }[];
};

export function summarizeHoursSaved(contents: (string | null)[]): HoursSavedSummary {
  const counts = new Map<HoursSavedCategory, number>();
  for (const c of contents) {
    const k = classifyAutomaticMessage(c);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const toHours = (n: number) => (n * SECONDS_PER_MESSAGE) / 3600;
  const categories = [...counts.entries()]
    .map(([key, count]) => ({ key, label: HOURS_SAVED_LABELS[key], count, hours: toHours(count) }))
    .sort((a, b) => b.count - a.count);
  return { totalMessages: contents.length, totalHours: toHours(contents.length), categories };
}
