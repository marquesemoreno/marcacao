import { getOwnerFinance } from "@/actions/owner-panel";
import { formatCurrency } from "@/lib/format";
import { BridgeProblem, MonthPicker, biCard as card, brDate, monthLabel } from "./shared";

/** Relatórios › Financeiro: contas a receber e a pagar lidas do sistema da clínica (só leitura). */
export async function FinanceTab({ month }: { month?: string }) {
  const { month: m, finance } = await getOwnerFinance(month ?? "");
  const head = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Financeiro — {monthLabel(m)}</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Fonte: contas a receber e a pagar do sistema da clínica
          {finance.ok && ` · última baixa ${brDate(finance.data.ultimaBaixa)} · último movimento ${brDate(finance.data.ultimoMovimento)}`}
        </p>
      </div>
      <MonthPicker aba="financeiro" month={m} />
    </div>
  );
  if (!finance.ok)
    return (
      <div className="space-y-5">
        {head}
        <BridgeProblem title="Financeiro" reason={finance.reason} />
      </div>
    );

  const f = finance.data;
  const staleDays = f.ultimaBaixa ? Math.floor((Date.now() - new Date(f.ultimaBaixa).getTime()) / 86_400_000) : null;
  return (
    <div className="space-y-5">
      {head}
      {staleDays !== null && staleDays > 7 && (
        <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          A última baixa (pagamento ou recebimento) no sistema é de {brDate(f.ultimaBaixa)}, há {staleDays} dias. Enquanto as baixas não forem
          lançadas, recebido, pago e vencido em aberto ficam desatualizados.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        {(
          [
            ["A receber", f.receber, "Recebido no mês"],
            ["A pagar", f.pagar, "Pago no mês"],
          ] as const
        ).map(([title, side, paidLabel]) => (
          <section key={title} className={card} aria-label={title}>
            <h3 className="font-semibold">{title}</h3>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-slate-500">Lançado no mês</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatCurrency(side.emitido)}</dd>
                <dd className="text-xs text-slate-500">{side.titulos} títulos</dd>
              </div>
              <div>
                <dt className="text-slate-500">{paidLabel}</dt>
                <dd className="text-xl font-semibold tabular-nums">{formatCurrency(side.baixado)}</dd>
              </div>
              <div className="col-span-2 border-t border-slate-100 pt-2 dark:border-slate-800">
                <dt className="text-slate-500">Vencido e em aberto (títulos dos últimos 12 meses)</dt>
                <dd className="font-semibold tabular-nums">
                  {formatCurrency(side.vencidoEmAberto)} <span className="font-normal text-slate-500">· {side.titulosVencidos} títulos</span>
                </dd>
              </div>
            </dl>
          </section>
        ))}
      </div>
      <p className="text-xs text-slate-400">
        Lançado = títulos emitidos no mês. Recebido/pago = baixas feitas no mês, de títulos de qualquer mês. Por isso os dois não precisam bater.
      </p>
      {f.planoDeContas.length > 0 && (
        <section className={card}>
          <h3 className="font-semibold">Por plano de contas — {monthLabel(m)}</h3>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {f.planoDeContas.map((c) => (
              <li key={`${c.tipo}-${c.conta}`} className="flex justify-between gap-3 py-1.5">
                <span>
                  <span className={c.tipo === "R" ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"}>
                    {c.tipo === "R" ? "Receita" : "Despesa"}
                  </span>{" "}
                  · {c.conta}
                </span>
                <span className="tabular-nums">{formatCurrency(c.total)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
