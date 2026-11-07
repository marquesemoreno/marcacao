"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setUrgencyTagEnabled } from "@/actions/ai-actions";

/** Gestão liga/desliga a etiqueta automática "🚨 Urgência Clínica" no Chat. */
export function UrgencyTagToggle({ enabled: initial, canToggle }: { enabled: boolean; canToggle: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-wrap items-start justify-between gap-3 rounded-2xl bg-white p-4 shadow-xs dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">Etiqueta de urgência clínica</h2>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          Quando o paciente relata sintoma grave, a conversa ganha “🚨 Urgência Clínica” e sobe na fila. Nada é enviado ao paciente.
          {!canToggle && " Só a gestão pode mudar."}
        </p>
      </div>
      <label className="inline-flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          className="h-5 w-5 accent-emerald-600"
          checked={enabled}
          disabled={!canToggle || pending}
          onChange={(e) => {
            const next = e.target.checked;
            start(async () => {
              try {
                const s = await setUrgencyTagEnabled(next);
                setEnabled(s.enabled);
                toast.success(s.enabled ? "Etiqueta de urgência ligada." : "Etiqueta de urgência desligada e removida das conversas.");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Não deu certo.");
              }
            });
          }}
        />
        {enabled ? "Ligada" : "Desligada"}
      </label>
    </section>
  );
}
