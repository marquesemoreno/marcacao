"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setWelcomeSettings } from "@/actions/welcome-message";

type Props = { welcomeEnabled: boolean; welcomeText: string; addressEnabled: boolean; address: string; canEdit: boolean };

/** Gestão liga a saudação automática (com {{saudacao}}/{{nome}}) e a resposta de endereço. */
export function WelcomeSettings(props: Props) {
  const [state, setState] = useState({ welcomeEnabled: props.welcomeEnabled, welcomeText: props.welcomeText, addressEnabled: props.addressEnabled });
  const [savedText, setSavedText] = useState(props.welcomeText);
  const [pending, start] = useTransition();

  const save = (next: typeof state, msg: string) =>
    start(async () => {
      try {
        const s = await setWelcomeSettings(next);
        setState({ welcomeEnabled: s.welcomeEnabled, welcomeText: s.welcomeText, addressEnabled: s.addressEnabled });
        setSavedText(s.welcomeText);
        toast.success(msg);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Não deu certo.");
      }
    });

  const disabled = !props.canEdit || pending;

  return (
    <>
      <section className="glass-surface p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-semibold">Saudação automática</h2>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
              Vai no primeiro contato do paciente e quando ele volta depois de um atendimento finalizado (6 h ou mais).
              Use <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{{saudacao}}"}</code> para Bom dia/Boa tarde/Boa
              noite e <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">{"{{nome}}"}</code> para o primeiro nome.
              {!props.canEdit && " Só a gestão pode mudar."}
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              className="h-5 w-5 accent-emerald-600"
              checked={state.welcomeEnabled}
              disabled={disabled}
              onChange={(e) => {
                const on = e.target.checked;
                save({ ...state, welcomeEnabled: on }, on ? "Saudação automática ligada." : "Saudação automática desligada.");
              }}
            />
            {state.welcomeEnabled ? "Ligada" : "Desligada"}
          </label>
        </div>
        <textarea
          rows={3}
          value={state.welcomeText}
          disabled={disabled}
          maxLength={1000}
          aria-label="Texto da saudação"
          onChange={(e) => setState((s) => ({ ...s, welcomeText: e.target.value }))}
          className="mt-3 w-full rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-70 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-100"
        />
        {props.canEdit && state.welcomeText !== savedText && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              disabled={pending}
              onClick={() => save(state, "Texto da saudação salvo.")}
              className="h-9 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Salvar texto
            </button>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-start justify-between gap-3 glass-surface p-5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Endereço automático</h2>
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">
            Quando o paciente pergunta “onde fica?”, “qual o endereço?” ou pede a localização, o sistema responde com o endereço e o
            link do Google Maps (no máximo uma vez a cada 12 h na mesma conversa).
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">📍 {props.address || "Endereço não cadastrado"}</p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="h-5 w-5 accent-emerald-600"
            checked={state.addressEnabled}
            disabled={disabled || !props.address}
            onChange={(e) => {
              const on = e.target.checked;
              save({ ...state, addressEnabled: on }, on ? "Endereço automático ligado." : "Endereço automático desligado.");
            }}
          />
          {state.addressEnabled ? "Ligado" : "Desligado"}
        </label>
      </section>
    </>
  );
}
