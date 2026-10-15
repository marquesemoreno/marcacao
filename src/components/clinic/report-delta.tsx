import { compareDelta } from "@/lib/report-period";

/** Variação vs período anterior ("↑ 8 pts vs setembro") — verde quando melhora, rosa
 * quando piora, neutra quando igual; o sentido também vai por extenso pra leitor de tela
 * (não só pela cor). Some quando não há base anterior. */
export function ReportDelta({
  current,
  previous,
  unit,
  better,
  compareLabel,
}: {
  current: number | null;
  previous: number | null;
  unit: "pts" | "%";
  better: "up" | "down";
  compareLabel: string;
}) {
  const d = compareDelta(current, previous, unit, better);
  if (!d) return null;
  const tone =
    d.good === null
      ? "text-slate-600 dark:text-slate-300"
      : d.good
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-rose-700 dark:text-rose-400";
  return (
    <span className={`text-xs font-semibold tabular-nums ${tone}`}>
      {d.text}
      {d.good !== null && <span className="sr-only">{d.good ? " (melhorou)" : " (piorou)"}</span>}{" "}
      <span className="font-normal text-slate-600 dark:text-slate-400">vs {compareLabel}</span>
    </span>
  );
}
