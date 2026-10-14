"use client";

import { useState } from "react";
import { ChevronDown, MessageCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AgendaItem, AgendaStatusChoice } from "@/lib/agenda";
import { AGENDA_STATUS_META, initialsOf, toTitleCase } from "@/lib/agenda-ui";
import { StatusIcon } from "./status-icon";
import { StatusMenu } from "./status-menu";

/** Card de uma marcação na grade. Clique abre o painel do paciente; o selo de status
 * abre a troca rápida. Status sempre com ícone + texto (ou ícone + rótulo acessível no
 * modo compacto da Semana), nunca só cor. */
export function AppointmentCard({
  item,
  compact = false,
  onOpen,
  onSetStatus,
}: {
  item: AgendaItem;
  compact?: boolean;
  onOpen: (item: AgendaItem) => void;
  onSetStatus: (item: AgendaItem, status: AgendaStatusChoice) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = AGENDA_STATUS_META[item.status];
  const name = toTitleCase(item.patientName || "Sem nome");
  const subtitle = [item.procedure, item.doctor].filter(Boolean).map((t) => toTitleCase(t!)).join(" · ");
  const struck = item.status === "CANCELLED";

  async function pick(status: AgendaStatusChoice) {
    setSaving(true);
    try {
      await onSetStatus(item, status);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={`relative rounded-lg border border-slate-200 dark:border-slate-700 ${meta.tint} shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors`}>
      <button
        type="button"
        onClick={() => onOpen(item)}
        className="w-full text-left px-2 pt-1.5 pb-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
        aria-label={`${item.time ?? "Sem horário"}, ${name}, ${meta.label}. Abrir ficha`}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!compact && (
            <span className="size-7 shrink-0 rounded-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-semibold text-slate-600 dark:text-slate-300 flex items-center justify-center">
              {initialsOf(name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100 min-w-0">
              {compact && <StatusIcon status={item.status} />}
              <span className="tabular-nums text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{item.time ?? "—"}</span>
              <span className={`truncate ${struck ? "line-through decoration-slate-400" : ""}`}>{name}</span>
              {item.phone && <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
            </p>
            {!compact && subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
          </div>
        </div>
      </button>
      {!compact && (
        <div className="px-2 pb-1.5">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className={`inline-flex h-6 items-center gap-1 rounded-md border px-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${meta.badge}`}
              aria-label={`Status: ${meta.label}. Alterar`}
            >
              <StatusIcon status={item.status} className="w-3 h-3" />
              {meta.label}
              <ChevronDown className="w-3 h-3 opacity-70" aria-hidden />
            </PopoverTrigger>
            <PopoverContent align="start" className="w-52 p-1">
              <StatusMenu item={item} disabled={saving} onPick={pick} />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
