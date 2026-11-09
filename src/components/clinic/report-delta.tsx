import { compareDelta } from "@/lib/report-period";

/** Variação vs período anterior ("↑ 8 pts vs setembro") — verde quando melhora, rosa
 * quando piora, neutra quando igual; o sentido também vai por extenso pra leitor de tela
 * (não só pela cor). Some quando não há base anterior. `chip` = selo arredondado (topo do Relatório). */
export function ReportDelta({
  current,
  previous,
  unit,
  better,
  compareLabel,
  variant = "text",
}: {
  current: number | null;
  previous: number | null;
  unit: "pts" | "%";
  better: "up" | "down";
  compareLabel: string;
  variant?: "text" | "chip";
}) {
  const d = compareDelta(current, previous, unit, better);
  if (!d) return null;
  const sr = d.good !== null && <span className="sr-only">{d.good ? " (melhorou)" : " (piorou)"}</span>;
  if (variant === "chip") {
    const chip =
      d.good === null
        ? "bg-slate-200/70 text-slate-700 dark:bg-white/10 dark:text-slate-200"
        : d.good
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300"
          : "bg-rose-100 text-rose-800 dark:bg-rose-400/15 dark:text-rose-300";
    return (
      <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${chip}`}>
        {d.text}
        {sr}
        <span className="ml-1 font-medium opacity-80">vs {compareLabel}</span>
      </span>
    );
  }
  const tone =
    d.good === null
      ? "text-slate-600 dark:text-slate-300"
      : d.good
        ? "text-emerald-700 dark:text-emerald-400"
        : "text-rose-700 dark:text-rose-400";
  return (
    <span className={`text-xs font-semibold tabular-nums ${tone}`}>
      {d.text}
      {sr}{" "}
      <span className="font-normal text-slate-600 dark:text-slate-400">vs {compareLabel}</span>
    </span>
  );
}
