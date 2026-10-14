"use client";

import { Check, RotateCcw } from "lucide-react";
import type { AgendaItem, AgendaStatusChoice, ManualAgendaStatus } from "@/lib/agenda";
import { AGENDA_STATUS_META } from "@/lib/agenda-ui";
import { StatusIcon } from "./status-icon";

const POSITIVE: ManualAgendaStatus[] = ["CONFIRMED", "IN_SERVICE", "COMPLETED"];
const NEGATIVE: ManualAgendaStatus[] = ["NO_SHOW", "CANCELLED"];

/** Opções de status do card e do painel do paciente: as do dia a dia em cima, as que
 * tiram o paciente da agenda (faltou/cancelado) separadas embaixo, e "voltar ao
 * automático" quando o status atual foi marcado à mão. */
export function StatusMenu({
  item,
  disabled,
  onPick,
}: {
  item: AgendaItem;
  disabled?: boolean;
  onPick: (status: AgendaStatusChoice) => void;
}) {
  const option = (s: ManualAgendaStatus) => (
    <button
      key={s}
      type="button"
      role="menuitemradio"
      aria-checked={item.status === s}
      disabled={disabled}
      onClick={() => onPick(s)}
      className="w-full flex items-center justify-between gap-2 rounded-md px-2 h-8 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50"
    >
      <span className="flex items-center gap-2">
        <StatusIcon status={s} />
        {AGENDA_STATUS_META[s].label}
      </span>
      {item.status === s && <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden />}
    </button>
  );
  return (
    <div role="menu" aria-label="Marcar status">
      {POSITIVE.map(option)}
      <div className="my-1 border-t border-slate-200 dark:border-slate-700" role="separator" />
      {NEGATIVE.map(option)}
      {item.isManual && (
        <>
          <div className="my-1 border-t border-slate-200 dark:border-slate-700" role="separator" />
          <button
            type="button"
            role="menuitem"
            disabled={disabled}
            onClick={() => onPick("AUTO")}
            className="w-full flex items-center gap-2 rounded-md px-2 h-8 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-50"
          >
            <RotateCcw className="w-3.5 h-3.5" aria-hidden />
            Voltar ao automático
          </button>
        </>
      )}
    </div>
  );
}
