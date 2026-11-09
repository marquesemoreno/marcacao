"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setAfterHoursBookingEnabled, setBookingAssistEnabled } from "@/actions/ai-actions";

type Setting = { enabled: boolean; duringHours: boolean; canToggle: boolean };

/** Gestão liga/desliga a IA que completa o pedido de marcação com o paciente: fora do horário e,
 * opcionalmente, no horário comercial quando a recepção demora 5 min (nível 1 do 4.1). */
export function AfterHoursBookingToggle({
  enabled: initial,
  duringHours: initialDuring = false,
  canToggle,
}: {
  enabled: boolean;
  duringHours?: boolean;
  canToggle: boolean;
}) {
  const [enabled, setEnabled] = useState(initial);
  const [duringHours, setDuringHours] = useState(initialDuring);
  const [pending, start] = useTransition();

  const toggle = (fn: (v: boolean) => Promise<Setting>, next: boolean, on: string, off: string) =>
    start(async () => {
      try {
        const s = await fn(next);
        setEnabled(s.enabled);
        setDuringHours(s.duringHours);
        toast.success(next ? on : off);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não deu certo.");
      }
    });

  return (
    <section className="space-y-3 glass-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Pedido de marcação pela IA</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Quando o paciente pede para marcar, a IA pergunta o que falta (consulta ou exame, médico, manhã ou tarde) e avisa
            que a recepção confirma. O pedido aparece em Agenda › Pedidos de marcação. A IA nunca promete horário e para quando
            alguém da equipe responde.
            {!canToggle && " Só a gestão pode mudar."}
          </p>
        </div>
      </div>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>Com a clínica fechada (noite, fim de semana, feriado)</span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-emerald-600"
          checked={enabled}
          disabled={!canToggle || pending}
          onChange={(e) =>
            toggle(setAfterHoursBookingEnabled, e.target.checked, "Fora do horário ligado.", "Fora do horário desligado.")
          }
        />
      </label>
      <label className="flex items-center justify-between gap-3 text-sm">
        <span>
          No horário comercial, se ninguém responder em 5 minutos
          <span className="block text-xs text-slate-500">Para a recepção cheia: o paciente não fica esperando sem resposta.</span>
        </span>
        <input
          type="checkbox"
          className="h-5 w-5 accent-emerald-600"
          checked={duringHours}
          disabled={!canToggle || pending}
          onChange={(e) =>
            toggle(setBookingAssistEnabled, e.target.checked, "Horário comercial ligado.", "Horário comercial desligado.")
          }
        />
      </label>
    </section>
  );
}
