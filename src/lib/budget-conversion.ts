/** Conversão de orçamentos (05/11/2026): das conversas que entraram em "Orçamento" no
 * período, quantas viraram agendamento, quantas foram perdidas e quantas seguem em aberto,
 * com e sem cobrança (ver budget-followup.ts). Puro e testado. */
import { outcomeLabel } from "./report-metrics";

export type BudgetRow = {
  value: number | null;
  /** Foi para Agendado depois de entrar em Orçamento. */
  scheduled: boolean;
  status: string;
  resolutionReason: string | null;
  followups: number;
};

export type BudgetOutcome = "convertido" | "perdido" | "aberto";

export function budgetOutcome(r: BudgetRow): BudgetOutcome {
  if (r.scheduled || r.resolutionReason === "AGENDAMENTO_CONCLUIDO") return "convertido";
  if (r.status === "RESOLVED") return "perdido";
  return "aberto";
}

const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

export function computeBudgetConversion(rows: BudgetRow[]) {
  const acc = { convertido: { count: 0, value: 0 }, perdido: { count: 0, value: 0 }, aberto: { count: 0, value: 0 } };
  const losses = new Map<string, number>();
  const withF = { count: 0, conv: 0 };
  const withoutF = { count: 0, conv: 0 };
  for (const r of rows) {
    const o = budgetOutcome(r);
    acc[o].count++;
    acc[o].value += r.value ?? 0;
    if (o === "perdido") {
      const key = r.resolutionReason ?? "OUTRO";
      losses.set(key, (losses.get(key) ?? 0) + 1);
    }
    const bucket = r.followups > 0 ? withF : withoutF;
    bucket.count++;
    if (o === "convertido") bucket.conv++;
  }
  const lossReasons = [...losses.entries()]
    .map(([reason, count]) => ({ reason, label: outcomeLabel(reason), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  return {
    total: rows.length,
    converted: acc.convertido,
    lost: acc.perdido,
    open: acc.aberto,
    /** % convertidos sobre todos os orçamentos do período. */
    rate: pct(acc.convertido.count, rows.length),
    withFollowup: { count: withF.count, rate: pct(withF.conv, withF.count) },
    withoutFollowup: { count: withoutF.count, rate: pct(withoutF.conv, withoutF.count) },
    lossReasons,
  };
}

export type BudgetConversion = ReturnType<typeof computeBudgetConversion>;
