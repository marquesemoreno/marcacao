import { PageHeader } from "@/components/clinic/page-header";
import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { getOwnerPanel } from "@/actions/owner-panel";
import { formatCurrency } from "@/lib/format";

export const metadata = { title: "Financeiro" };
export const dynamic = "force-dynamic";

const card = "rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs";
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
/** "202610" ou "2026-10" → "out/26" */
const monthLabel = (ym: string) => {
  const d = ym.replace("-", "");
  return `${MONTHS[Number(d.slice(4, 6)) - 1]}/${d.slice(2, 4)}`;
};
const br = (ymd: string | null) => (ymd ? ymd.split("-").reverse().join("/") : "—");

function lastMonths(n: number) {
  const now = new Date(Date.now() - 3 * 3600_000);
  return Array.from({ length: n }, (_, i) =>
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7)
  );
}

/** Painel do dono (Etapa 5.2): financeiro e estoque lidos do sistema da clínica pela ponte. */
export default async function FinanceiroPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const params = await searchParams;
  const { month, finance, stock } = await getOwnerPanel(params.mes ?? "");
  const staleDays =
    finance.ok && finance.data.ultimaBaixa
      ? Math.floor((Date.now() - new Date(finance.data.ultimaBaixa).getTime()) / 86_400_000)
      : null;

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5 p-4 sm:p-6 max-w-5xl">
        <PageHeader title="Financeiro e estoque" subtitle="Lido do sistema da clínica, só leitura. Só a gestão vê esta página." />
        <form action="/clinic/financeiro" className="flex items-end gap-2">
          <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Mês
            <select
              name="mes"
              defaultValue={month}
              className="mt-1 block h-9 w-40 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
            >
              {lastMonths(12).map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="h-9 rounded-md bg-slate-900 dark:bg-slate-100 px-4 text-sm font-semibold text-white dark:text-slate-900">
            Ver
          </button>
        </form>

        {!finance.ok ? (
          <section className={card}>
            <h2 className="font-semibold">Financeiro</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {finance.reason === "unavailable"
                ? "O sistema da clínica ainda não está conectado ao financeiro (a ponte precisa ser atualizada)."
                : "Não consegui falar com o sistema da clínica agora. Tente de novo em instantes."}
            </p>
          </section>
        ) : (
          <>
            {staleDays !== null && staleDays > 7 && (
              <p role="status" className="rounded-xl bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                A última baixa (pagamento ou recebimento) no sistema é de {br(finance.data.ultimaBaixa)}, há {staleDays} dias. Enquanto as
                baixas não forem lançadas, recebido, pago e vencido em aberto ficam desatualizados.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ["A receber", finance.data.receber, "Recebido no mês"],
                  ["A pagar", finance.data.pagar, "Pago no mês"],
                ] as const
              ).map(([title, side, paidLabel]) => (
                <section key={title} className={card} aria-label={title}>
                  <h2 className="font-semibold">{title}</h2>
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
                    <div className="col-span-2 border-t border-slate-100 dark:border-slate-800 pt-2">
                      <dt className="text-slate-500">Vencido e em aberto (títulos dos últimos 12 meses)</dt>
                      <dd className="font-semibold tabular-nums">
                        {formatCurrency(side.vencidoEmAberto)}{" "}
                        <span className="font-normal text-slate-500">· {side.titulosVencidos} títulos</span>
                      </dd>
                    </div>
                  </dl>
                </section>
              ))}
            </div>
            {finance.data.planoDeContas.length > 0 && (
              <section className={card}>
                <h2 className="font-semibold">Por plano de contas — {monthLabel(month)}</h2>
                <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                  {finance.data.planoDeContas.map((c) => (
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
          </>
        )}

        {!stock.ok ? (
          <section className={card}>
            <h2 className="font-semibold">Estoque</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {stock.reason === "unavailable"
                ? "O estoque ainda não está conectado (a ponte precisa ser atualizada)."
                : "Não consegui ler o estoque agora."}
            </p>
          </section>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <section className={card}>
              <h2 className="font-semibold">Estoque</h2>
              <dl className="mt-3 grid grid-cols-3 gap-3 text-sm">
                <div>
                  <dt className="text-slate-500">Saídas 30 dias</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stock.data.consumo.qtd30.toLocaleString("pt-BR")}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Saídas 90 dias</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stock.data.consumo.qtd90.toLocaleString("pt-BR")}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Parados 180 dias</dt>
                  <dd className="text-xl font-semibold tabular-nums">{stock.data.paradosSemSaida180.toLocaleString("pt-BR")}</dd>
                </div>
              </dl>
              <ul className="mt-4 space-y-1 text-sm">
                {stock.data.locais.map((l) => (
                  <li key={l.local} className="flex justify-between gap-3">
                    <span className="text-slate-700 dark:text-slate-300">{l.local}</span>
                    <span className="tabular-nums text-slate-500">{l.produtosComSaldo} produtos com saldo</span>
                  </li>
                ))}
              </ul>
              {stock.data.comprasPorMes.length > 0 && (
                <>
                  <h3 className="mt-4 text-sm font-semibold">Compras (notas de entrada)</h3>
                  <ul className="mt-1 space-y-1 text-sm">
                    {stock.data.comprasPorMes.map((c) => (
                      <li key={c.mes} className="flex justify-between gap-3">
                        <span>{monthLabel(c.mes)}</span>
                        <span className="tabular-nums text-slate-500">
                          {formatCurrency(c.total)} · {c.notas} notas
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
            <section className={card}>
              <h2 className="font-semibold">Mais usados (30 dias)</h2>
              <ol className="mt-3 space-y-1 text-sm">
                {stock.data.maisUsados30.map((p) => (
                  <li key={p.produto} className="flex justify-between gap-3">
                    <span className="truncate">{p.produto}</span>
                    <span className="tabular-nums text-slate-500">{p.qtd.toLocaleString("pt-BR")}</span>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-xs text-slate-400">
                Quantidades em unidades de saída. O valor do consumo ainda não aparece: o sistema não guarda o custo por unidade.
              </p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
