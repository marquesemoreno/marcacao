"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setClosingMessageSetting } from "@/actions/closing-message";

/** Gestão liga a despedida automática ao finalizar e edita o texto (src/lib/closing-message.ts). */
export function ClosingMessageSetting({ enabled: initialEnabled, text: initialText, canEdit }: { enabled: boolean; text: string; canEdit: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [text, setText] = useState(initialText);
  const [saved, setSaved] = useState(initialText);
  const [pending, start] = useTransition();

  const save = (next: { enabled: boolean; text: string }) =>
    start(async () => {
      try {
        const s = await setClosingMessageSetting(next);
        setEnabled(s.enabled);
        setText(s.text);
        setSaved(s.text);
        toast.success(s.enabled ? "Despedida automática ligada." : "Despedida automática desligada.");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não deu certo.");
      }
    });

  return (
    <section className="glass-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Despedida ao finalizar</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Ao finalizar o atendimento, o sistema manda esta mensagem ao paciente. A atendente pode desmarcar no momento de
            finalizar. Não sai quando o paciente não respondeu, passou de 24 h ou a despedida já foi enviada.
            {!canEdit && " Só a gestão pode mudar."}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-emerald-600"
            checked={enabled}
            disabled={!canEdit || pending}
            onChange={(e) => save({ enabled: e.target.checked, text })}
          />
          {enabled ? "Ligada" : "Desligada"}
        </label>
      </div>
      <textarea
        rows={3}
        value={text}
        disabled={!canEdit || pending}
        onChange={(e) => setText(e.target.value)}
        maxLength={1000}
        aria-label="Texto da despedida"
        className="mt-3 w-full rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
      />
      {canEdit && text !== saved && (
        <div className="mt-2 flex justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={() => save({ enabled, text })}
            className="h-9 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Salvar texto
          </button>
        </div>
      )}
    </section>
  );
}
