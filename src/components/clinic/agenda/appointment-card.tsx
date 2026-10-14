"use client";

import { useState } from "react";
import { CalendarClock, ChevronDown, MessageCircle, UserCheck } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { AgendaItem, AgendaStatusChoice } from "@/lib/agenda";
import { AGENDA_STATUS_META, initialsOf, toTitleCase, todayInBahia } from "@/lib/agenda-ui";
import { StatusIcon } from "./status-icon";
import { StatusMenu } from "./status-menu";

/** Ainda não chegou: candidatos ao botão de um toque "Chegou". */
const AWAITING_ARRIVAL = new Set(["PENDING", "SENT", "CONFIRMED"]);

/** Card de uma marcação na grade. Clique abre o painel do paciente; o selo de status
 * (ou o ícone, no modo compacto da Semana) abre a troca de status. No dia, quem ainda
 * não chegou tem "Chegou" de um toque; quem quer remarcar tem "Remarcar". */
export function AppointmentCard({
  item,
  compact = false,
  onOpen,
  onSetStatus,
  onReschedule,
}: {
  item: AgendaItem;
  compact?: boolean;
  onOpen: (item: AgendaItem) => void;
  onSetStatus: (item: AgendaItem, status: AgendaStatusChoice) => Promise<void>;
  onReschedule: (item: AgendaItem) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const meta = AGENDA_STATUS_META[item.status];
  const name = toTitleCase(item.patientName || "Sem nome");
  const subtitle = [item.procedure, item.doctor].filter(Boolean).map((t) => toTitleCase(t!)).join(" · ");
  const struck = item.status === "CANCELLED";
  const isToday = item.date === todayInBahia();
  const canArrive = isToday && AWAITING_ARRIVAL.has(item.status);
  const wantsReschedule = item.status === "RESCHEDULE";

  async function pick(status: AgendaStatusChoice) {
    setSaving(true);
    try {
      await onSetStatus(item, status);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  const menu = (
    <PopoverContent align="start" className="w-56 p-1">
      <StatusMenu item={item} disabled={saving} onPick={pick} />
    </PopoverContent>
  );

  const quickBtn =
    "inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:opacity-50";

  return (
    <div
      className={`relative rounded-lg border ${
        item.status === "PENDING" ? "border-dashed border-amber-300 dark:border-amber-700" : "border-slate-200 dark:border-slate-700"
      } ${meta.tint} shadow-xs hover:border-slate-300 dark:hover:border-slate-600 transition-colors`}
    >
      <div className="flex items-start">
        {compact && (
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              className="ml-1 mt-1.5 inline-flex size-6 shrink-0 items-center justify-center rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              aria-label={`Status: ${meta.label}. Alterar`}
              title={meta.label}
            >
              <StatusIcon status={item.status} />
            </PopoverTrigger>
            {menu}
          </Popover>
        )}
        <button
          type="button"
          onClick={() => onOpen(item)}
          className="min-w-0 flex-1 text-left px-2 pt-1.5 pb-1 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
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
                <span className="tabular-nums text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">{item.time ?? "—"}</span>
                <span className={`truncate ${struck ? "line-through decoration-slate-400" : ""}`} title={name}>
                  {name}
                </span>
                {item.phone && <MessageCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />}
              </p>
              {!compact && subtitle && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{subtitle}</p>}
            </div>
          </div>
        </button>
      </div>

      {(!compact || canArrive || wantsReschedule) && (
        <div className="flex flex-wrap items-center gap-1 px-2 pb-1.5">
          {!compact && (
            <Popover open={open} onOpenChange={setOpen}>
              <PopoverTrigger className={`${quickBtn} border ${meta.badge}`} aria-label={`Status: ${meta.label}. Alterar`}>
                <StatusIcon status={item.status} className="w-3 h-3" />
                {meta.label}
                <ChevronDown className="w-3 h-3 opacity-70" aria-hidden />
              </PopoverTrigger>
              {menu}
            </Popover>
          )}
          {canArrive && (
            <button
              type="button"
              disabled={saving}
              onClick={() => pick("IN_SERVICE")}
              className={`${quickBtn} border border-sky-300 dark:border-sky-800 bg-white dark:bg-slate-900 text-sky-800 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/50`}
              aria-label={`${name} chegou — marcar como presente`}
            >
              <UserCheck className="w-3 h-3" aria-hidden /> Chegou
            </button>
          )}
          {wantsReschedule && (
            <button
              type="button"
              onClick={() => onReschedule(item)}
              className={`${quickBtn} bg-violet-600 hover:bg-violet-700 text-white`}
              aria-label={`Remarcar ${name}`}
            >
              <CalendarClock className="w-3 h-3" aria-hidden /> Remarcar
            </button>
          )}
        </div>
      )}
    </div>
  );
}
