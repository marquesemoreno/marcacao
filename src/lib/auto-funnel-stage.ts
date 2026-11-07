/** Etapa do CRM a partir do que a recepção escreveu (07/11/2026). Em 30 dias, 428 mensagens da
 * equipe tinham "R$" e só 2 conversas estavam em Orçamento — a etapa (e a fila de cobrança
 * 3/7/15 dias) ficava vazia porque ninguém mudava à mão. Nunca volta de etapa. */
import { hasSchedulingMessage } from "./conversation-auto-close";

type Stage = "NOVOS" | "TRIAGEM" | "ORCAMENTO" | "AGENDADO";

const ORDER: Record<Stage, number> = { NOVOS: 0, TRIAGEM: 1, ORCAMENTO: 2, AGENDADO: 3 };
const NOT_A_QUOTE = /comprovante|recebemos o pagamento|pagamento recebido|nota fiscal|reembolso|estorno|recibo/i;
/** "R$ 250,00", "R$1.500", "R$ 350" — menor que R$ 30 (taxa, troco) não conta. */
const PRICE = /R\$\s*(\d{1,3}(?:\.\d{3})*|\d+)(?:,\d{2})?/gi;

function hasQuote(text: string): boolean {
  if (NOT_A_QUOTE.test(text)) return false;
  for (const m of text.matchAll(PRICE)) {
    if (Number(m[1].replace(/\./g, "")) >= 30) return true;
  }
  return false;
}

export function stageFromStaffMessage(text: string | null | undefined, current: Stage): "ORCAMENTO" | "AGENDADO" | null {
  const t = text ?? "";
  if (!t.trim()) return null;
  const next: "ORCAMENTO" | "AGENDADO" | null = hasSchedulingMessage([{ direction: "OUTBOUND", content: t }])
    ? "AGENDADO"
    : hasQuote(t)
      ? "ORCAMENTO"
      : null;
  return next && ORDER[next] > ORDER[current] ? next : null;
}
