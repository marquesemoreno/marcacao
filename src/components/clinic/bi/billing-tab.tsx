import { AlertTriangle, Info } from "lucide-react";
import { getBiBilling } from "@/actions/bi/billing";
import { formatCurrency } from "@/lib/format";

import { BridgeProblem, MonthPicker, biCard as card, brDate as br, monthLabel } from "./shared";

const pct = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
const compact = (n: number) =>
  n >= 1000 ? `R$ ${(n / 1000).toLocaleString("pt-BR", { maximumFractionDigits: n >= 100_000 ? 0 : 1 })} mil` : formatCurrency(n);

/** Selo das regras que ainda dependem de confirmação da clínica. */
function ToConfirm() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-900/50 dark:text-amber-200">
      <Info className="size-3" aria-hidden />A confirmar com a clínica
    </span>
  );
}

/** BI › Faturamento: total com a regra explícita, comparação por dia útil, tendência de 12 meses,
 * convênios (com valores atípicos sinalizados) e médicos com a cobertura da atribuição. */
export async function BillingTab({ month }: { month?: string }) {
  const v = await getBiBilling(month ?? "");
  if (!v.ok) return <BridgeProblem title="Faturamento" reason={v.reason} />;

  const { composition: c, comparison: cmp, guias } = v;
  const lidoEm = new Date(v.geradoEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
  const atypicalIds = new Set(v.atypical.map((a) => a.convenio));
  const maxTrend = Math.max(1, ...v.trend.map((t) => t.porDia ?? 0));
  const prevMonth = (() => {
    const [y, m] = v.month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Faturamento — {monthLabel(v.month)}</h2>
            <ToConfirm />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fonte: {v.fonte} · última guia lançada em {br(v.ultimaGuia)} · lido em {lidoEm} (atualiza a cada 3 h)
          </p>
        </div>
        <MonthPicker aba="faturamento" month={v.month} />
      </div>

      <section className={card} aria-label="Faturado no mês">
        <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
          <div className="relative overflow-hidden rounded-[1.5rem] bg-blue-600 p-5 text-white shadow-[0_18px_36px_-22px_rgb(37_99_235/0.8)]">
            <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-white/15 blur-2xl" />
            <p className="relative text-sm font-medium text-blue-100">Faturado (guias){v.partial ? ` — até ${br(v.fim)}` : ""}</p>
            <p className="relative mt-2 text-4xl font-semibold tracking-tight tabular-nums">{formatCurrency(c.total)}</p>
            <p className="relative mt-1.5 text-xs text-blue-100">
              {guias.qtd.toLocaleString("pt-BR")} guias · {v.days} dias úteis{v.partial ? " até agora" : ""}
              {guias.zeradas > 0 && ` · ${guias.zeradas} guias com valor zero`}
            </p>
          </div>
          <div className="report-well p-4">
            <p className="text-sm text-slate-500">Média por dia útil</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{cmp?.perDay != null ? formatCurrency(cmp.perDay) : "—"}</p>
            {cmp && cmp.changePct !== null ? (
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
                <span
                  className={`font-semibold ${cmp.changePct > 0 ? "text-emerald-700 dark:text-emerald-400" : cmp.changePct < 0 ? "text-rose-700 dark:text-rose-400" : ""}`}
                >
                  {cmp.changePct > 0 ? "↑" : cmp.changePct < 0 ? "↓" : "="} {pct(Math.abs(cmp.changePct))}
                </span>{" "}
                vs {monthLabel(prevMonth)} ({formatCurrency(cmp.prevPerDay ?? 0)} por dia útil, {formatCurrency(cmp.prevTotal)} no mês)
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-500">Sem base do mês anterior para comparar.</p>
            )}
            <p className="mt-2 text-[11px] text-slate-400">
              Comparação sempre pela média por dia útil (seg–sex, sem feriado nacional), para meses de tamanhos diferentes não parecerem queda ou alta.
            </p>
          </div>
        </div>

        <details className="mt-5 border-t border-slate-100 pt-4 dark:border-slate-800" open>
          <summary className="cursor-pointer text-sm font-semibold">O que entra no total</summary>
          <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="font-medium">{c.rules[0].label}</dt>
              <dd className="text-lg font-semibold tabular-nums">{formatCurrency(c.total)}</dd>
              <dd className="mt-1 text-xs text-slate-500">{c.rules[0].rule}</dd>
            </div>
            <div>
              <dt className="flex flex-wrap items-center gap-1.5 font-medium">
                {c.rules[1].label} <ToConfirm />
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-500">{formatCurrency(v.internacoes.valor)}</dd>
              <dd className="text-xs text-slate-500">
                {v.internacoes.qtd} internações · {v.internacoes.qtdCasada} casam com guia
                {c.internacaoForaDasGuias > 0 && ` · ${formatCurrency(c.internacaoForaDasGuias)} fora das guias`}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">{c.rules[1].rule}</dd>
            </div>
            <div>
              <dt className="flex flex-wrap items-center gap-1.5 font-medium">
                {c.rules[2].label} <ToConfirm />
              </dt>
              <dd className="text-lg font-semibold tabular-nums text-slate-500">{formatCurrency(v.recibos.valor)}</dd>
              <dd className="text-xs text-slate-500">
                {v.recibos.qtd} recibos
                {c.reciboForaDasGuias > 0 && ` · ${formatCurrency(c.reciboForaDasGuias)} sem guia ligada`}
              </dd>
              <dd className="mt-1 text-xs text-slate-500">{c.rules[2].rule}</dd>
            </div>
          </dl>
        </details>
      </section>

      {v.trend.length > 0 && (
        <section className={card} aria-label="Tendência de 12 meses">
          <h3 className="font-semibold">Últimos 12 meses — média por dia útil</h3>
          <p className="text-xs text-slate-500">Altura = faturado ÷ dias úteis do mês. O total do mês aparece embaixo.</p>
          <div className="mt-4 flex h-48 items-end gap-1 sm:gap-2" role="list">
            {v.trend.map((t) => (
              <div key={t.mes} className="flex h-full min-w-0 flex-1 flex-col items-center gap-1" role="listitem">
                <span className="sr-only">
                  {monthLabel(t.mes)}: {t.porDia != null ? formatCurrency(t.porDia) : "—"} por dia útil, {formatCurrency(t.valor)} no mês
                  {t.partial ? " (parcial)" : ""}
                </span>
                <span className="text-[10px] font-semibold tabular-nums text-slate-700 dark:text-slate-200" aria-hidden>
                  {t.porDia != null ? compact(t.porDia) : "—"}
                </span>
                <div className="flex min-h-0 w-full flex-1 items-end justify-center" aria-hidden>
                  <div
                    className={`w-full max-w-10 rounded-t-[4px] ${
                      t.mes === v.month ? "bg-sky-600" : t.partial ? "bg-sky-300/60 dark:bg-sky-700/50" : "bg-sky-400/70 dark:bg-sky-500/50"
                    }`}
                    style={{ height: `${Math.max(2, ((t.porDia ?? 0) / maxTrend) * 100)}%` }}
                    title={`${monthLabel(t.mes)}: ${formatCurrency(t.valor)} em ${t.dias} dias úteis`}
                  />
                </div>
                <span className="text-[10px] font-medium text-slate-600 dark:text-slate-400" aria-hidden>
                  {monthLabel(t.mes)}
                  {t.partial ? "*" : ""}
                </span>
                <span className="hidden text-[10px] tabular-nums text-slate-400 sm:block" aria-hidden>
                  {compact(t.valor)}
                </span>
              </div>
            ))}
          </div>
          {v.trend.some((t) => t.partial) && <p className="mt-2 text-[11px] text-slate-400">* mês em andamento, contado até hoje.</p>}
        </section>
      )}

      {v.atypical.length > 0 && (
        <section role="status" className="rounded-2xl bg-amber-50 p-5 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
          <h3 className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="size-4" aria-hidden />
            Valores fora do padrão
          </h3>
          <p className="mt-1 text-xs">Continuam no total — aparecem aqui para a clínica conferir se o lançamento está certo.</p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {v.atypical.map((a) => (
              <li key={a.convenio}>
                <span className="font-semibold">{a.nome}</span>: {a.motivos.join("; ")} — {a.guias} guias
                {a.median !== null && `, mediana ${formatCurrency(a.median)} por guia`}
                {a.zeroCount > 0 && `, ${a.zeroCount} com valor zero`}.
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className={card} aria-label="Por convênio">
          <h3 className="font-semibold">Por convênio</h3>
          <p className="text-xs text-slate-500">Valor das guias do mês. Mediana = valor típico de uma guia (sem as zeradas).</p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500">
                <th className="py-1 font-medium">Convênio</th>
                <th className="py-1 text-right font-medium">Guias</th>
                <th className="py-1 text-right font-medium">Valor</th>
                <th className="py-1 text-right font-medium">%</th>
                <th className="py-1 text-right font-medium">Mediana</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {guias.porConvenio.slice(0, 15).map((p) => (
                <tr key={p.id}>
                  <td className="max-w-[10rem] truncate py-1.5">
                    {p.convenio}
                    {atypicalIds.has(p.id) && (
                      <AlertTriangle className="ml-1 inline size-3.5 text-amber-600" aria-label="valor fora do padrão" />
                    )}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{p.qtd}</td>
                  <td className="py-1.5 text-right tabular-nums">{formatCurrency(p.valor)}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">{c.total > 0 ? pct((p.valor / c.total) * 100) : "—"}</td>
                  <td className="py-1.5 text-right tabular-nums text-slate-500">{p.mediana !== null ? formatCurrency(p.mediana) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {guias.porConvenio.length > 15 && (
            <p className="mt-2 text-xs text-slate-400">+ {guias.porConvenio.length - 15} convênios menores.</p>
          )}
        </section>

        <section className={card} aria-label="Por médico">
          <h3 className="font-semibold">Por médico</h3>
          <p className="text-xs text-slate-500">
            Só procedimentos lançados com médico.
            {v.coberturaMedico !== null && (
              <>
                {" "}
                Eles somam {formatCurrency(v.valorComMedico)} — <strong>{pct(v.coberturaMedico)}</strong> do faturado. O resto não tem médico
                no lançamento, então este ranking não é a produção completa de cada um.
              </>
            )}
          </p>
          <ul className="mt-3 divide-y divide-slate-100 text-sm dark:divide-slate-800">
            {v.medicos.slice(0, 15).map((m) => (
              <li key={m.medico} className="flex justify-between gap-3 py-1.5">
                <span className="truncate">{m.medico}</span>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {formatCurrency(m.total)} · {m.procedimentos}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {(v.datasInvalidas > 0 || guias.zeradas > 0) && (
        <section className={card} aria-label="Qualidade dos dados">
          <h3 className="font-semibold">Qualidade dos dados</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-400">
            {guias.zeradas > 0 && (
              <li>
                {guias.zeradas} guias do mês estão com valor zero ({pct((guias.zeradas / Math.max(1, guias.qtd)) * 100)}). Contam na quantidade, não no valor.
              </li>
            )}
            {v.datasInvalidas > 0 && (
              <li>{v.datasInvalidas} guias no sistema têm data impossível (antes de 2000 ou mais de 30 dias no futuro) e ficam fora de qualquer mês.</li>
            )}
          </ul>
        </section>
      )}
    </div>
  );
}
