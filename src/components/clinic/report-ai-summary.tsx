"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { generateReportSummary } from "@/actions/clinic-insights";

/** Resumo do período com IA, gerado sob demanda (custa uma chamada). A IA só recebe os
 * fatos já calculados, nunca dados de paciente; sem resposta, mostra os próprios fatos. */
export function ReportAiSummary({ clinicName, periodLabel, facts }: { clinicName: string; periodLabel: string; facts: string[] }) {
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "done" | "failed">("idle");

  async function generate() {
    setState("loading");
    try {
      const r = await generateReportSummary({ clinicName, periodLabel, facts });
      setText(r.text);
      setState(r.text ? "done" : "failed");
    } catch {
      setState("failed");
    }
  }

  return (
    <section aria-labelledby="ia-resumo-titulo" className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs p-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="ia-resumo-titulo" className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" aria-hidden />
          O que mudou e o que fazer
        </h2>
        {facts.length > 0 && (
          <button
            type="button"
            onClick={generate}
            disabled={state === "loading"}
            className="inline-flex h-8 items-center gap-1.5 px-3 text-sm font-medium text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-800 rounded-lg hover:bg-violet-50 dark:hover:bg-violet-950/40 disabled:opacity-60"
          >
            {state === "loading" && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />}
            {state === "done" ? "Gerar de novo" : "Gerar resumo com IA"}
          </button>
        )}
      </div>
      {facts.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Nenhuma mudança relevante em relação ao período anterior.</p>
      ) : state === "done" && text ? (
        <div aria-live="polite" className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800 dark:text-slate-200">
          {text}
        </div>
      ) : (
        <>
          {state === "failed" && <p className="text-xs text-amber-800 dark:text-amber-300">A IA não respondeu agora — seguem os destaques calculados.</p>}
          <ul className="list-disc pl-5 space-y-1 text-sm text-slate-800 dark:text-slate-200">
            {facts.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
