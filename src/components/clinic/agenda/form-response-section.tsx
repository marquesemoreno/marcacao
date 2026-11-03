"use client";

import { useEffect, useState } from "react";
import { ClipboardCheck, Loader2, Lock } from "lucide-react";
import { getAppointmentFormResponse } from "@/actions/patient-forms";
import type { AgendaItem } from "@/lib/agenda";

type Response = Awaited<ReturnType<typeof getAppointmentFormResponse>>;

/** Ficha prévia no painel do paciente. Dado de saúde: só carrega quando alguém clica em
 * "Ver respostas" — cada abertura fica registrada em Acessos. */
export function FormResponseSection({
  item,
  load = getAppointmentFormResponse,
}: {
  item: AgendaItem;
  /** Médico usa a ação dele (só paciente dele de hoje). */
  load?: (ref: { source: "BRIDGE" | "LOCAL"; externalId: string }) => Promise<Response>;
}) {
  const [data, setData] = useState<Response | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    setData(undefined);
    setError(false);
  }, [item.key]);
  if (!item.formDone) return null;

  return (
    <section className="rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20 p-3 text-sm">
      <h3 className="flex items-center gap-2 font-semibold text-emerald-900 dark:text-emerald-200">
        <ClipboardCheck className="h-4 w-4" aria-hidden /> Ficha prévia enviada
      </h3>
      {data === undefined ? (
        <>
          <button
            type="button"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              setError(false);
              try {
                setData(await load({ source: item.source, externalId: item.externalId }));
              } catch {
                setError(true);
              } finally {
                setLoading(false);
              }
            }}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Lock className="h-3.5 w-3.5" aria-hidden />} Ver respostas
          </button>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Dado de saúde — a abertura fica registrada em Acessos.</p>
          {error && <p role="alert" className="mt-1 text-xs text-rose-700">Não foi possível abrir. Tente de novo.</p>}
        </>
      ) : data === null ? (
        <p className="mt-1 text-slate-600">As respostas não foram encontradas.</p>
      ) : (
        <dl className="mt-2 space-y-2">
          {data.items.map((a) => (
            <div key={a.label}>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{a.label}</dt>
              <dd className="whitespace-pre-line text-slate-900 dark:text-slate-100">{a.value}</dd>
            </div>
          ))}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Enviada em {new Date(data.submittedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bahia" })}
          </p>
        </dl>
      )}
    </section>
  );
}
