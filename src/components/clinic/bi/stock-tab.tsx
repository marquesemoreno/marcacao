import { getOwnerStock } from "@/actions/owner-panel";
import { formatCurrency } from "@/lib/format";
import { BridgeProblem, biCard as card, monthLabel } from "./shared";

/** Relatórios › Estoque: saídas, parados e compras lidos do sistema da clínica (só leitura). */
export async function StockTab() {
  const stock = await getOwnerStock();
  const lidoEm = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Estoque</h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">Fonte: almoxarifado do sistema da clínica · lido em {lidoEm} · janelas contadas a partir de hoje</p>
      </div>
      {!stock.ok ? (
        <BridgeProblem title="Estoque" reason={stock.reason} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className={card}>
            <h3 className="font-semibold">Movimento</h3>
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
            <p className="mt-2 text-xs text-slate-400">Parados = produtos com saldo e nenhuma saída nos últimos 180 dias.</p>
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
            <h3 className="font-semibold">Mais usados (30 dias)</h3>
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
  );
}
