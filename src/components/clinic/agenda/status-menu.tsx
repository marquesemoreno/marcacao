"use client";

import { Check, RotateCcw } from "lucide-react";
import type { AgendaItem, AgendaStatusChoice, ManualAgendaStatus } from "@/lib/agenda";
import { AGENDA_STATUS_META, todayInBahia } from "@/lib/agenda-ui";
import { StatusIcon } from "./status-icon";

const POSITIVE: ManualAgendaStatus[] = ["CONFIRMED", "IN_SERVICE", "COMPLETED"];
const NEGATIVE: ManualAgendaStatus[] = ["NO_SHOW", "CANCELLED"];
/** Só fazem sentido no dia (ou depois): ninguém chega, é atendido ou falta amanhã. */
const SAME_DAY_ONLY: ManualAgendaStatus[] = ["IN_SERVICE", "COMPLETED", "NO_SHOW"];

const itemClass =
  "w-full flex items-center justify-between gap-2 rounded-md px-2 h-8 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-40 disabled:hover:bg-transparent";

/** Opções de status do card e do painel do paciente: as do dia a dia em cima, as que
 * tiram o paciente da agenda (faltou/cancelado) separadas embaixo, e "usar o status do
 * lembrete" quando o atual foi marcado à mão. Botões simples com aria-pressed (não
 * role=menu: não prometer ao leitor de tela uma navegação por setas que não existe). */
export function StatusMenu({
  item,
  disabled,
  onPick,
}: {
  item: AgendaItem;
  disabled?: boolean;
  onPick: (status: AgendaStatusChoice) => void;
}) {
  const future = item.date > todayInBahia();
  const option = (s: ManualAgendaStatus) => {
    const blocked = future && SAME_DAY_ONLY.includes(s);
    return (
      <button
        key={s}
        type="button"
        aria-pressed={item.status === s}
        disabled={disabled || blocked}
        title={blocked ? "Disponível no dia da consulta" : undefined}
        onClick={() => onPick(s)}
        className={itemClass}
      >
        <span className="flex items-center gap-2">
          <StatusIcon status={s} />
          {AGENDA_STATUS_META[s].label}
        </span>
        {item.status === s && <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden />}
      </button>
    );
  };
  return (
    <div role="group" aria-label="Marcar status">
      {POSITIVE.map(option)}
      <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
      {NEGATIVE.map(option)}
      {item.isManual && (
        <>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
          <button type="button" disabled={disabled} onClick={() => onPick("AUTO")} className={`${itemClass} justify-start`}>
            <RotateCcw className="w-3.5 h-3.5" aria-hidden />
            Usar o status do lembrete
          </button>
        </>
      )}
    </div>
  );
}
