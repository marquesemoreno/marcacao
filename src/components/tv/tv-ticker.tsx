"use client";

import { tickerDurationSec, type TickerItem } from "@/lib/tv-ticker";

/** Letreiro no rodapé da TV: avisos da clínica e manchetes, passando sem parar. O texto vai
 * duas vezes seguidas para a volta ser contínua. Com "reduzir movimento", fica parado no 1º item.
 * Secundário de propósito (28/11): fonte menor, cinza sobre fundo sólido, devagar, e some na
 * chamada (`hidden`) — não disputa o olhar com o nome do paciente. */
export function TvTicker({ items, hidden = false }: { items: TickerItem[]; hidden?: boolean }) {
  if (items.length === 0) return null;
  const chars = items.reduce((s, i) => s + i.text.length + 20, 0);
  const row = (hidden: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((i, k) => (
        <span key={k} className="flex items-center whitespace-nowrap px-[2vw]">
          {i.source ? (
            <span className="mr-[0.8vw] text-[0.75em] font-semibold uppercase tracking-wider text-sky-400/80">Saúde</span>
          ) : (
            <span className="mr-[0.8vw] text-[0.75em] font-semibold uppercase tracking-wider text-emerald-400/80">Aviso</span>
          )}
          {i.text}
          <span className="ml-[2vw] text-slate-700">•</span>
        </span>
      ))}
    </div>
  );
  const hasNews = items.some((i) => i.source);
  return (
    <div
      className={`relative flex items-center overflow-hidden border-t border-slate-800/80 bg-slate-950 py-[1vh] text-[clamp(0.9rem,1.35vw,1.6rem)] text-slate-300 transition-opacity duration-500 ${hidden ? "opacity-0" : "opacity-100"}`}
      aria-hidden={hidden || undefined}
    >
      <style>{`@keyframes tv-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}@media (prefers-reduced-motion: reduce){.tv-ticker-track{animation:none!important}}`}</style>
      <div className="tv-ticker-track flex w-max" style={{ animation: `tv-ticker ${tickerDurationSec(chars)}s linear infinite` }}>
        {row(false)}
        {row(true)}
      </div>
      {hasNews && (
        <span className="absolute right-0 top-0 bottom-0 flex items-center bg-slate-950 pl-[1vw] pr-[1.2vw] text-[0.7em] font-medium text-slate-500">
          <span aria-hidden className="absolute -left-[3vw] top-0 bottom-0 w-[3vw] bg-gradient-to-l from-slate-950 to-transparent" />
          Notícias: Agência Brasil
        </span>
      )}
    </div>
  );
}
