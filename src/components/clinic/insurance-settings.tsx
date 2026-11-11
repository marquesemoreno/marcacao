"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setInsuranceSettings, type InsuranceSettingsView } from "@/actions/insurance-settings";
import { insuranceReply, parseInsuranceList } from "@/lib/insurance-reply";

/** Gestão cadastra os convênios aceitos e liga a resposta automática de "vocês aceitam X?". */
export function InsuranceSettings(props: InsuranceSettingsView) {
  const [enabled, setEnabled] = useState(props.enabled);
  const [listText, setListText] = useState(props.accepted.join("\n"));
  const [note, setNote] = useState(props.note);
  const [saved, setSaved] = useState({ listText: props.accepted.join("\n"), note: props.note });
  const [pending, start] = useTransition();

  const accepted = parseInsuranceList(listText);
  const dirty = listText !== saved.listText || note !== saved.note;
  const disabled = !props.canEdit || pending;

  const save = (nextEnabled: boolean, msg: string) =>
    start(async () => {
      try {
        const s = await setInsuranceSettings({ enabled: nextEnabled, acceptedText: listText, note });
        const text = s.accepted.join("\n");
        setEnabled(s.enabled);
        setListText(text);
        setNote(s.note);
        setSaved({ listText: text, note: s.note });
        toast.success(msg);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não deu certo.");
      }
    });

  const field =
    "mt-1 w-full rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100";

  return (
    <section className="glass-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Convênios aceitos</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Quando o paciente pergunta “vocês aceitam Unimed?” ou “quais convênios atendem?”, o sistema responde com esta lista (no máximo uma vez a cada 12 h na mesma
            conversa). Pergunta sobre autorização ou guia continua com a recepção.
            {!props.canEdit && " Só a gestão pode mudar."}
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-emerald-600"
            checked={enabled}
            disabled={disabled || (!enabled && accepted.length === 0)}
            onChange={(e) => save(e.target.checked, e.target.checked ? "Resposta de convênios ligada." : "Resposta de convênios desligada.")}
          />
          {enabled ? "Ligada" : "Desligada"}
        </label>
      </div>

      <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Convênios que a clínica atende (um por linha)
        <textarea rows={5} value={listText} disabled={disabled} onChange={(e) => setListText(e.target.value)} placeholder={"Unimed\nBradesco Saúde\nCassi"} className={field} />
      </label>
      <label className="mt-3 block text-sm font-medium text-slate-700 dark:text-slate-300">
        Frase no fim da resposta (opcional)
        <input value={note} disabled={disabled} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: Também atendemos particular." className={field} />
      </label>

      {accepted.length > 0 && (
        <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/[0.04] dark:text-slate-300">
          <p className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Exemplo de resposta a “quais convênios vocês atendem?”:</p>
          <p className="whitespace-pre-wrap">{insuranceReply({ accepted, mentioned: null, note })}</p>
        </div>
      )}

      {props.canEdit && dirty && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            disabled={pending || (enabled && accepted.length === 0)}
            onClick={() => save(enabled, "Convênios salvos.")}
            className="h-9 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            Salvar convênios
          </button>
        </div>
      )}
    </section>
  );
}
