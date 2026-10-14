"use client";

import { useState } from "react";
import { Check, ChevronDown, MessageCircle, Store } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { MANUAL_AGENDA_STATUSES, type AgendaItem, type ManualAgendaStatus } from "@/lib/agenda";
import { AGENDA_STATUS_META, initialsOf, toTitleCase } from "@/lib/agenda-ui";

/** Card de uma marcação na grade. Clique abre o painel do paciente; o selo de status
 * abre a troca rápida (confirmado, presente, atendido, falta, cancelado). */
export function AppointmentCard({
  item,
  compact = false,
  onOpen,
  onSetStatus,
}: {
  item: AgendaItem;
  compact?: boolean;
  onOpen: (item: AgendaItem) => void;
  onSetStatus: (item: AgendaItem, status: ManualAgendaStatus) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = AGENDA_STATUS_META[item.status];
  const name = toTitleCase(item.patientName || "Sem nome");
  const subtitle = [item.procedure, item.doctor].filter(Boolean).join(" · ");

  async function pick(status: ManualAgendaStatus) {
    setSaving(true);
    try {
      await onSetStatus(item, status);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className={`group relative rounded-lg border border-slate-200 dark:border-slate-700 border-l-4 ${meta.card} bg-white dark:bg-slate-900 shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors`}
    >
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full text-left px-2 py-1.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 rounded-lg"
        aria-label={`${item.time ?? "Ordem de chegada"} — ${name}. Abrir ficha`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!compact && (
            <span className="size-6 shrink-0 rounded-full bg-slate-100 dark:bg-slate-800 text-[10px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center">
              {initialsOf(name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 min-w-0">
              <span className="tabular-nums text-slate-500 dark:text-slate-400 font-medium shrink-0">{item.time ?? "Chegada"}</span>
              <span className="truncate">{name}</span>
              {item.phone ? (
                <MessageCircle className="w-3 h-3 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Tem WhatsApp" />
              ) : (
                <Store className="w-3 h-3 shrink-0 text-slate-400" aria-label="Sem WhatsApp (presencial)" />
              )}
            </p>
            {!compact && subtitle && <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{toTitleCase(subtitle)}</p>}
          </div>
        </div>
      </button>
      {!compact && (
        <div className="px-2 pb-1.5 -mt-0.5">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${meta.badge}`}
              aria-label={`Status: ${meta.label}. Alterar`}
            >
              {meta.label}
              <ChevronDown className="w-3 h-3" aria-hidden />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1">
              <p className="px-2 py-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">Marcar como</p>
              {MANUAL_AGENDA_STATUSES.map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={saving}
                  onClick={() => pick(s)}
                  className="w-full flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-2 rounded-full ${AGENDA_STATUS_META[s].card.replace("border-l-", "bg-")}`} aria-hidden />
                    {AGENDA_STATUS_META[s].label}
                  </span>
                  {item.status === s && <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden />}
                </button>
              ))}
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
