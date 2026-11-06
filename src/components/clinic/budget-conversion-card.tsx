import { formatCurrency } from "@/lib/format";
import type { BudgetConversion } from "@/lib/budget-conversion";

/** Conversão de orçamentos no Relatório — só aparece quando houve orçamento no período. */
export function BudgetConversionCard({ data }: { data: BudgetConversion }) {
  if (!data.total) return null;
  const segs = [
    { label: "Viraram agendamento", ...data.converted, bar: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
    { label: "Perdidos", ...data.lost, bar: "bg-rose-400", text: "text-rose-700 dark:text-rose-400" },
    { label: "Em aberto", ...data.open, bar: "bg-violet-300 dark:bg-violet-500/60", text: "text-violet-700 dark:text-violet-300" },
  ];
  const showCompare = data.withFollowup.count > 0 && data.withoutFollowup.count > 0;
  return (
    <section aria-labelledby="orc-titulo" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
      <h3 id="orc-titulo" className="font-semibold">Conversão de orçamentos</h3>
      <p className="mt-3">
        <span className="text-4xl font-semibold tabular-nums">{data.rate}%</span>
        <span className="ml-2 text-sm text-slate-500">
          de {data.total} orçamento{data.total === 1 ? "" : "s"} enviado{data.total === 1 ? "" : "s"} no período viraram agendamento
        </span>
      </p>

      <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800" aria-hidden>
        {segs.map((s) => (
          <div key={s.label} className={s.bar} style={{ width: `${(s.count / data.total) * 100}%` }} />
        ))}
      </div>
      <dl className="mt-3 grid gap-4 sm:grid-cols-3 text-sm">
        {segs.map((s) => (
          <div key={s.label}>
            <dt className="text-slate-500">{s.label}</dt>
            <dd className={`font-semibold tabular-nums ${s.text}`}>
              {s.count}
              {s.value > 0 && <span className="ml-1.5 font-normal text-slate-600 dark:text-slate-400">· {formatCurrency(s.value)}</span>}
            </dd>
          </div>
        ))}
      </dl>

      {(showCompare || data.lossReasons.length > 0) && (
        <div className="mt-4 grid gap-4 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm sm:grid-cols-2">
          {showCompare && (
            <div>
              <p className="text-slate-500">Efeito da cobrança</p>
              <p className="mt-1">
                <span className="font-semibold tabular-nums">{data.withFollowup.rate}%</span> com cobrança ({data.withFollowup.count})
                <span className="mx-1.5 text-slate-400">vs</span>
                <span className="font-semibold tabular-nums">{data.withoutFollowup.rate}%</span> sem ({data.withoutFollowup.count})
              </p>
            </div>
          )}
          {data.lossReasons.length > 0 && (
            <div>
              <p className="text-slate-500">Por que perdemos</p>
              <ul className="mt-1 space-y-0.5">
                {data.lossReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-3">
                    <span className="text-slate-700 dark:text-slate-300">{r.label}</span>
                    <span className="tabular-nums text-slate-500">{r.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
