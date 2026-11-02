"use client";

import { useState } from "react";
import { AlertTriangle, Check, RotateCcw } from "lucide-react";
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
  // Crítica 02/11: Faltou/Cancelado num toque, logo abaixo de Atendido. Na marcação do sistema
  // da clínica isso gera trabalho lá também — pede um segundo toque.
  const [confirming, setConfirming] = useState<ManualAgendaStatus | null>(null);
  const option = (s: ManualAgendaStatus) => {
    const blocked = future && SAME_DAY_ONLY.includes(s);
    return (
      <button
        key={s}
        type="button"
        aria-pressed={item.status === s}
        disabled={disabled || blocked}
        title={blocked ? "Disponível no dia da consulta" : undefined}
        onClick={() => {
          if (NEGATIVE.includes(s) && item.status !== s && confirming !== s) return setConfirming(s);
          setConfirming(null);
          onPick(s);
        }}
        className={`${itemClass} ${confirming === s ? "bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 font-semibold" : ""}`}
      >
        <span className="flex items-center gap-2">
          <StatusIcon status={s} />
          {confirming === s ? `Toque de novo: ${AGENDA_STATUS_META[s].label.toLowerCase()}` : AGENDA_STATUS_META[s].label}
        </span>
        {item.status === s && <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden />}
      </button>
    );
  };
  return (
    <div role="group" aria-label="Marcar status" data-status-menu>
      {POSITIVE.map(option)}
      <div className="my-1 border-t border-slate-200 dark:border-slate-700" />
      {NEGATIVE.map(option)}
      {confirming && (
        <p role="status" className="flex items-start gap-1.5 px-2 pt-1 text-xs text-slate-600 dark:text-slate-300">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" aria-hidden />
          {item.source === "BRIDGE" ? "Também precisa ser feito no sistema da clínica." : "Tira o paciente da agenda (dá pra desfazer)."}
        </p>
      )}
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
