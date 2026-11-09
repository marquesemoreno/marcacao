import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";

/** Topo do Relatório (piloto de estilo 09/11/2026): indicadores em pílula de vidro e
 * cartões de destaque coloridos. Só números reais do período — nada decorativo. */

export function KpiPill({
  icon: Icon,
  value,
  label,
  delta,
  hint,
  valueClass = "",
}: {
  icon: LucideIcon;
  value: string;
  label: string;
  delta?: React.ReactNode;
  hint?: string;
  valueClass?: string;
}) {
  return (
    <div className="report-surface flex items-center gap-4 !rounded-[1.5rem] px-4 py-3.5">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-white text-slate-700 shadow-[0_6px_16px_-8px_rgb(15_23_42/0.35)] ring-1 ring-slate-900/5 dark:bg-white/10 dark:text-slate-100 dark:ring-white/10">
        <Icon className="size-5" aria-hidden strokeWidth={1.75} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className={`text-2xl font-semibold leading-none tracking-tight tabular-nums ${valueClass}`}>{value}</p>
          {delta}
        </div>
        <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300">{label}</p>
        {hint && <p className="text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
      </div>
    </div>
  );
}

const TONES = {
  blue: { tile: "bg-blue-600 text-white", sub: "text-blue-100", btn: "bg-white/15 hover:bg-white/25 text-white ring-white/25" },
  teal: { tile: "bg-teal-700 text-white", sub: "text-teal-100", btn: "bg-white/15 hover:bg-white/25 text-white ring-white/25" },
  ink: {
    tile: "bg-slate-950 text-white ring-1 ring-white/10 dark:bg-[#1f2128]",
    sub: "text-slate-300",
    btn: "bg-white text-slate-900 hover:bg-slate-200 ring-transparent",
  },
  sun: { tile: "bg-amber-300 text-amber-950", sub: "text-amber-900", btn: "bg-amber-950/10 hover:bg-amber-950/20 text-amber-950 ring-amber-950/15" },
} as const;

export type TileTone = keyof typeof TONES;

/** Cartão de destaque: título, número grande e um botão redondo que leva à seção do detalhe. */
export function HighlightTile({
  tone,
  title,
  value,
  sub,
  href,
  linkLabel,
}: {
  tone: TileTone;
  title: string;
  value: string;
  sub: string;
  href: string;
  linkLabel: string;
}) {
  const t = TONES[tone];
  return (
    <div
      className={`relative flex min-h-[9.5rem] flex-col justify-between overflow-hidden rounded-[1.75rem] p-5 shadow-[0_18px_36px_-22px_rgb(15_23_42/0.55)] ${t.tile}`}
    >
      {/* brilho suave no canto, para o cartão não ficar chapado */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/15 blur-2xl" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-[15px] font-semibold leading-snug">{title}</p>
        <Link
          href={href}
          aria-label={linkLabel}
          className={`grid size-9 shrink-0 place-items-center rounded-full ring-1 transition-colors focus-visible:outline-offset-2 ${t.btn}`}
        >
          <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="relative">
        <p className="text-[2rem] font-semibold leading-none tracking-tight tabular-nums">{value}</p>
        <p className={`mt-1.5 text-sm ${t.sub}`}>{sub}</p>
      </div>
    </div>
  );
}
