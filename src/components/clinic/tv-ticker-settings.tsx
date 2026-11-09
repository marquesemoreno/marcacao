"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveTickerSettings } from "@/actions/tv-call";
import { TICKER_MAX_NOTICES, TICKER_NOTICE_MAX_CHARS } from "@/lib/tv-ticker";

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4";

/** Letreiro no rodapé da TV: avisos da clínica (um por linha) + notícias de saúde. */
export function TvTickerSettings({ initial }: { initial: { notices: string; news: boolean } }) {
  const [notices, setNotices] = useState(initial.notices);
  const [news, setNews] = useState(initial.news);
  const [pending, start] = useTransition();
  const lines = notices.split(/\r?\n/).filter((l) => l.trim()).length;

  function save() {
    start(async () => {
      try {
        const r = await saveTickerSettings({ notices, news });
        toast.success(r.notices || news ? "Letreiro salvo. A TV atualiza em até 15 minutos." : "Letreiro desligado.");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <section className={panel} aria-labelledby="tv-ticker">
      <h2 id="tv-ticker" className="text-sm font-semibold">Letreiro de avisos e notícias</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Passa no rodapé da TV o tempo todo. Quando chama uma senha, a chamada aparece por cima.</p>

      <label htmlFor="tv-ticker-notices" className="mt-3 block text-xs font-medium text-slate-600 dark:text-slate-300">
        Avisos da clínica — um por linha (até {TICKER_MAX_NOTICES}, {TICKER_NOTICE_MAX_CHARS} caracteres cada)
      </label>
      <textarea
        id="tv-ticker-notices"
        rows={4}
        value={notices}
        onChange={(e) => setNotices(e.target.value)}
        placeholder={"Dia 15/11 (feriado) não abriremos.\nTraga documento com foto e a carteirinha do convênio.\nVacinação contra a gripe: pergunte na recepção."}
        className="mt-1 w-full rounded-lg border border-slate-200 bg-white p-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 dark:border-slate-700 dark:bg-slate-900"
      />
      {lines > TICKER_MAX_NOTICES && <p className="text-xs text-amber-700 dark:text-amber-400">Só os {TICKER_MAX_NOTICES} primeiros avisos aparecem.</p>}

      <label className="mt-3 flex items-start gap-2 text-sm">
        <input type="checkbox" checked={news} onChange={(e) => setNews(e.target.checked)} className="mt-0.5 size-4 accent-emerald-600" />
        <span>
          Mostrar notícias de saúde
          <span className="block text-xs text-slate-500 dark:text-slate-400">
            Manchetes da Agência Brasil (agência pública, reprodução livre citando a fonte), atualizadas a cada 30 minutos. Manchetes sobre morte ou
            violência são puladas automaticamente.
          </span>
        </span>
      </label>

      <div className="mt-3 flex justify-end">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar letreiro
        </button>
      </div>
    </section>
  );
}
