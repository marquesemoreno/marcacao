"use client";

import { useState } from "react";
import { Loader2, PhoneMissed } from "lucide-react";
import { setMissedCallRecovery } from "@/actions/missed-call-settings";

/** Gestão liga/desliga a recuperação de ligação perdida pelo WhatsApp (/clinic/tarefas). */
export function MissedCallSettings(props: { enabled: boolean; sentToday: number; tasksToday: number }) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      await setMissedCallRecovery(!enabled);
      setEnabled(!enabled);
    } catch {
      setError("Não deu para salvar. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 md:mx-6">
      <div className="min-w-0 flex-1">
        <h2 className="flex items-center gap-2 font-semibold">
          <PhoneMissed className="h-4 w-4" aria-hidden /> Ligação perdida pelo WhatsApp
        </h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Quem ligou e ninguém atendeu recebe uma mensagem convidando a escrever: em horário comercial depois de 2 min, fora dele na hora.
          No máximo 1 por número a cada 24 h e 3 por hora / 20 por dia na clínica. Passou disso, ou a mensagem não saiu, vira tarefa aqui.
        </p>
        {enabled && (
          <p className="mt-1 text-sm text-slate-500 tabular-nums">
            Hoje: {props.sentToday} mensagens · {props.tasksToday} tarefas
          </p>
        )}
        {error && (
          <p role="alert" className="mt-1 text-sm text-red-700 dark:text-red-300">
            {error}
          </p>
        )}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        disabled={saving}
        onClick={toggle}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium dark:border-slate-700"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
        {enabled ? "Ligado" : "Desligado"}
      </button>
    </section>
  );
}
