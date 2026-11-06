"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAfterHoursBookingEnabled } from "@/actions/ai-actions";

/** Gestão liga/desliga a IA que completa o pedido de marcação com o paciente fora do horário. */
export function AfterHoursBookingToggle({ enabled: initial, canToggle }: { enabled: boolean; canToggle: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [pending, start] = useTransition();
  return (
    <section className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="min-w-0 flex-1">
        <h2 className="text-sm font-semibold">Marcação fora do horário</h2>
        <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
          Com a clínica fechada, quando o paciente pede para marcar, a IA pergunta o que falta (consulta ou exame, médico,
          manhã ou tarde) e avisa quando a recepção confirma. O pedido aparece em Agenda › Pedidos de marcação. A IA nunca
          promete horário e para quando alguém da equipe responde.
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
                const s = await setAfterHoursBookingEnabled(next);
                setEnabled(s.enabled);
                toast.success(s.enabled ? "Marcação fora do horário ligada." : "Marcação fora do horário desligada.");
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
