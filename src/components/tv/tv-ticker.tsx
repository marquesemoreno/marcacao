"use client";

import { tickerDurationSec, type TickerItem } from "@/lib/tv-ticker";

/** Letreiro no rodapé da TV: avisos da clínica e manchetes, passando sem parar. O texto vai
 * duas vezes seguidas para a volta ser contínua. Com "reduzir movimento", fica parado no 1º item. */
export function TvTicker({ items }: { items: TickerItem[] }) {
  if (items.length === 0) return null;
  const chars = items.reduce((s, i) => s + i.text.length + 20, 0);
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((i, k) => (
        <span key={k} className="flex items-center whitespace-nowrap px-[2vw]">
          {i.source ? (
            <span className="mr-[0.8vw] rounded bg-sky-500/20 px-[0.6vw] py-[0.2vh] text-[0.7em] font-bold uppercase tracking-wider text-sky-300">Saúde</span>
          ) : (
            <span className="mr-[0.8vw] rounded bg-emerald-500/20 px-[0.6vw] py-[0.2vh] text-[0.7em] font-bold uppercase tracking-wider text-emerald-300">Aviso</span>
          )}
          {i.text}
          <span className="ml-[2vw] text-slate-600">•</span>
        </span>
      ))}
    </div>
  );
  const hasNews = items.some((i) => i.source);
  return (
    <div className="relative flex items-center overflow-hidden border-t border-slate-800 bg-slate-900/80 backdrop-blur-md py-[1.2vh] text-[clamp(1rem,1.8vw,2.1rem)] text-slate-100">
      <style>{`@keyframes tv-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: reduce){.tv-ticker-track{animation:none!important}}`}</style>
      <div className="tv-ticker-track flex w-max" style={{ animation: `tv-ticker ${tickerDurationSec(chars) * 2}s linear infinite` }}>
        {row(false)}
        {row(true)}
      </div>
      {hasNews && (
        <span className="absolute right-0 top-0 bottom-0 flex items-center bg-slate-900 pl-[1vw] pr-[1.2vw] text-[0.7em] font-medium text-slate-300">
          <span aria-hidden className="absolute -left-[3vw] top-0 bottom-0 w-[3vw] bg-gradient-to-l from-slate-900 to-transparent" />
          Notícias: Agência Brasil
        </span>
      )}
    </div>
  );
}
