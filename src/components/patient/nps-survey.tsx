"use client";

import { useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { submitNps } from "@/actions/patient-nps";

/** Nota de 0 a 10 + comentário opcional. Botões grandes, um toque escolhe. */
export function NpsSurvey({ token, clinicName }: { token: string; clinicName: string }) {
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [reviewUrl, setReviewUrl] = useState<string | null>(null);

  if (done) {
    return (
      <div className="mt-10 rounded-xl border border-emerald-200 bg-white p-6 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-600" aria-hidden />
        <h1 className="mt-2 text-lg font-semibold">Obrigado!</h1>
        <p className="mt-1 text-sm text-slate-600">Sua resposta ajuda {clinicName} a cuidar melhor de você.</p>
        {reviewUrl && (
          <>
            <p className="mt-4 text-sm text-slate-700">Que bom que gostou! Pode contar isso no Google? Leva menos de um minuto e ajuda outras pessoas a nos encontrar.</p>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex h-12 w-full items-center justify-center rounded-lg bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
            >
              Avaliar no Google
            </a>
          </>
        )}
      </div>
    );
  }

  return (
    <form
      className="space-y-5 rounded-xl border border-slate-200 bg-white p-5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (score === null) return setError("Escolha uma nota de 0 a 10.");
        setBusy(true);
        setError(null);
        const r = await submitNps(token, score, comment).catch(() => ({ ok: false as const, error: "Sem conexão. Tente de novo." }));
        setBusy(false);
        if (r.ok) {
          setReviewUrl(r.reviewUrl ?? null);
          setDone(true);
        }
        else setError(r.error);
      }}
    >
      <p className="text-sm font-medium text-emerald-700">{clinicName}</p>
      <fieldset>
        <legend className="text-lg font-semibold leading-snug">De 0 a 10, quanto você recomendaria a clínica a um amigo ou familiar?</legend>
        <div className="mt-4 grid grid-cols-6 gap-2" role="radiogroup" aria-label="Nota de 0 a 10">
          {Array.from({ length: 11 }, (_, n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              onClick={() => setScore(n)}
              className={`h-12 rounded-lg border text-base font-semibold tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                score === n ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-1 flex justify-between text-xs text-slate-500">
          <span>0 = nada provável</span>
          <span>10 = com certeza</span>
        </div>
      </fieldset>
      <label className="block">
        <span className="text-sm font-medium">Quer contar o motivo? (opcional)</span>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-3 text-base text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        />
      </label>
      {error && <p role="alert" className="text-sm text-rose-700">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-base font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2"
      >
        {busy && <Loader2 className="h-5 w-5 animate-spin" aria-hidden />} Enviar
      </button>
    </form>
  );
}
