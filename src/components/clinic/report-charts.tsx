/** Gráficos simples do /clinic/relatorio — SVG/HTML puro, sem lib de chart (o volume de
 * dados por clínica é pequeno o bastante que uma lib inteira seria peso desnecessário).
 * Sempre com o valor por extenso ao lado de cada marca — nunca só a cor carregando o dado
 * (ver skill de dataviz: rótulo direto, nunca clipado, nunca só cor). */

type BarDatum = { label: string; value: number; colorClass: string };

/** Barras horizontais — categoria à esquerda, marca <=24px de altura, ponta arredondada
 * (4px) na extremidade do dado, quadrada na base (aqui, a base é a borda esquerda). */
export function HorizontalBarChart({ data, unit }: { data: BarDatum[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (data.every((d) => d.value === 0)) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum dado no período.</p>;
  }
  return (
    <div className="space-y-2.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 sm:w-36 shrink-0 truncate text-xs font-medium text-slate-600 dark:text-slate-300">
            {d.label}
          </span>
          <div className="flex-1 h-5 flex items-center">
            <div
              className={`h-5 rounded-r-[4px] ${d.colorClass} transition-all`}
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-14 shrink-0 text-right text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">
            {d.value}
            {unit}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Barra única segmentada (soma ~100%) — usada pra sentimento. `rounded-full h-3` fina
 * demais pra rótulo dentro do segmento, por isso o valor por extenso vive só na legenda
 * abaixo (ver skill de dataviz: rótulo direto, nunca só cor carregando o dado). */
export function SentimentBar({
  positivePct,
  neutroPct,
  negativoPct,
}: {
  positivePct: number;
  neutroPct: number;
  negativoPct: number;
}) {
  const segments = [
    { key: "positivo", label: "Positivo", pct: positivePct, colorClass: "bg-emerald-500" },
    { key: "neutro", label: "Neutro", pct: neutroPct, colorClass: "bg-slate-400" },
    { key: "negativo", label: "Negativo", pct: negativoPct, colorClass: "bg-rose-400" },
  ];
  const total = positivePct + neutroPct + negativoPct;

  if (total === 0) {
    return <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma conversa auditada no período.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        {segments
          .filter((s) => s.pct > 0)
          .map((s) => (
            <div
              key={s.key}
              className={`h-full ${s.colorClass}`}
              style={{ width: `${s.pct}%` }}
              title={`${s.label}: ${s.pct}%`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
        {segments.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className={`inline-block w-2 h-2 rounded-full ${s.colorClass}`} />
            {s.label}: {s.pct}%
          </span>
        ))}
      </div>
    </div>
  );
}
