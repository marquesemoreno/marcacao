import type { getClinicNpsReport } from "@/actions/clinic-nps";

type Nps = Awaited<ReturnType<typeof getClinicNpsReport>>;

const BUCKET = {
  PROMOTER: "text-emerald-700 dark:text-emerald-400",
  PASSIVE: "text-amber-700 dark:text-amber-400",
  DETRACTOR: "text-rose-700 dark:text-rose-400",
} as const;

/** Satisfação (NPS) no Relatório — só aparece quando há respostas no período. */
export function NpsCard({ nps }: { nps: Nps }) {
  if (!nps.total || nps.nps === null) return null;
  const pct = (n: number) => Math.round((n / nps.total) * 100);
  return (
    <section aria-labelledby="nps-titulo" className="report-surface p-5">
      <h3 id="nps-titulo" className="font-semibold">Satisfação (NPS)</h3>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-3">
        <p>
          <span className={`text-4xl font-semibold tabular-nums ${nps.nps >= 50 ? BUCKET.PROMOTER : nps.nps >= 0 ? BUCKET.PASSIVE : BUCKET.DETRACTOR}`}>{nps.nps}</span>
          <span className="ml-2 text-sm text-slate-500">de −100 a 100 · {nps.total} {nps.total === 1 ? "resposta" : "respostas"}</span>
        </p>
        <dl className="flex gap-6 text-sm">
          <div><dt className="text-slate-500">Promotores (9–10)</dt><dd className={`font-semibold tabular-nums ${BUCKET.PROMOTER}`}>{pct(nps.promoters)}%</dd></div>
          <div><dt className="text-slate-500">Neutros (7–8)</dt><dd className={`font-semibold tabular-nums ${BUCKET.PASSIVE}`}>{pct(nps.passives)}%</dd></div>
          <div><dt className="text-slate-500">Detratores (0–6)</dt><dd className={`font-semibold tabular-nums ${BUCKET.DETRACTOR}`}>{pct(nps.detractors)}%</dd></div>
        </dl>
      </div>
      {nps.comments.length > 0 && (
        <ul className="mt-4 space-y-2 border-t border-slate-100 dark:border-slate-800 pt-3 text-sm">
          {nps.comments.map((c, i) => (
            <li key={i} className="flex gap-3">
              <span className={`w-6 shrink-0 text-right font-semibold tabular-nums ${BUCKET[c.bucket]}`}>{c.score}</span>
              <span className="text-slate-700 dark:text-slate-300">“{c.text}”</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
