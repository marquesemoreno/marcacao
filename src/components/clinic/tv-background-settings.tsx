"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { saveTvBackgroundSetting } from "@/actions/tv-call";
import { LANDSCAPES, TV_BACKGROUNDS, TV_BACKGROUND_LABEL, type TvBackground } from "@/lib/tv-background";

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4";

const HELP: Record<TvBackground, string> = {
  LISO: "Fundo escuro, sem imagem.",
  ARTE: "Cores da marca se movendo bem devagar.",
  PAISAGENS: "Mar, lagos e campos; troca a cada 12 minutos.",
};

/** Miniatura de cada opção, para a gestão ver antes de escolher. */
function Thumb({ mode }: { mode: TvBackground }) {
  const base = "relative h-16 w-full overflow-hidden rounded-md bg-slate-950";
  if (mode === "LISO") return <div className={base} aria-hidden />;
  if (mode === "ARTE")
    return (
      <div className={base} aria-hidden>
        <div className="absolute -left-4 -top-6 h-16 w-20 rounded-full bg-emerald-600 opacity-60 blur-xl" />
        <div className="absolute -right-4 top-2 h-16 w-20 rounded-full bg-cyan-700 opacity-60 blur-xl" />
        <div className="absolute -bottom-8 left-8 h-14 w-20 rounded-full bg-indigo-700 opacity-60 blur-xl" />
        <div className="absolute inset-0 bg-slate-950/40" />
      </div>
    );
  return (
    <div className={base} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={LANDSCAPES[0].url.replace("w=1920", "w=320")} alt="" className="h-full w-full object-cover" loading="lazy" />
      <div className="absolute inset-0 bg-slate-950/55" />
    </div>
  );
}

/** Fundo do painel da TV: Liso, Arte suave ou Paisagens. */
export function TvBackgroundSettings({ initial }: { initial: TvBackground }) {
  const [value, setValue] = useState<TvBackground>(initial);
  const [saved, setSaved] = useState<TvBackground>(initial);
  const [pending, start] = useTransition();

  function save() {
    start(async () => {
      try {
        await saveTvBackgroundSetting(value);
        setSaved(value);
        toast.success(`Fundo "${TV_BACKGROUND_LABEL[value]}" salvo. A TV atualiza em até 15 minutos.`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });
  }

  return (
    <section className={panel} aria-labelledby="tv-background">
      <h2 id="tv-background" className="text-sm font-semibold">Fundo do painel</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        A imagem fica escurecida atrás das senhas, que continuam legíveis de longe. Na hora da chamada o fundo escurece mais.
      </p>

      <div role="radiogroup" aria-labelledby="tv-background" className="mt-3 grid gap-3 sm:grid-cols-3">
        {TV_BACKGROUNDS.map((mode) => (
          <label
            key={mode}
            className={`cursor-pointer rounded-lg border p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald-500/50 ${
              value === mode ? "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-slate-200 hover:border-slate-300 dark:border-slate-700"
            }`}
          >
            <input type="radio" name="tv-background" value={mode} checked={value === mode} onChange={() => setValue(mode)} className="sr-only" />
            <Thumb mode={mode} />
            <span className="mt-2 block text-sm font-medium">{TV_BACKGROUND_LABEL[mode]}</span>
            <span className="block text-xs text-slate-500 dark:text-slate-400">{HELP[mode]}</span>
          </label>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-end gap-3">
        {value === "PAISAGENS" && <span className="mr-auto text-xs text-slate-500 dark:text-slate-400">Fotos do Unsplash, de uso livre.</span>}
        <button
          type="button"
          disabled={pending || value === saved}
          onClick={save}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar fundo
        </button>
      </div>
    </section>
  );
}
