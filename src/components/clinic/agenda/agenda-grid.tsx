"use client";

import { Plus } from "lucide-react";
import { AGENDA_ROWS, rowToTime, slotRowFor, type AgendaItem, type ManualAgendaStatus } from "@/lib/agenda";
import { AppointmentCard } from "./appointment-card";

export type AgendaColumn = { id: string; label: string; sublabel?: string; date: string; doctor: string | null; items: AgendaItem[]; highlight?: boolean };

/** Grade de horários 07:00–19:00 em linhas de 15 min, uma coluna por dia (Semana) ou por
 * médico (Dia / Por médico). Sem posição absoluta: cada célula empilha as marcações
 * daquele intervalo — a ponte não informa a hora de fim. Clique na célula vazia abre o
 * Novo Agendamento já com data, hora e médico. */
export function AgendaGrid({
  columns,
  compact = false,
  onSlotClick,
  onOpen,
  onSetStatus,
}: {
  columns: AgendaColumn[];
  compact?: boolean;
  onSlotClick: (column: AgendaColumn, time: string) => void;
  onOpen: (item: AgendaItem) => void;
  onSetStatus: (item: AgendaItem, status: ManualAgendaStatus) => Promise<void>;
}) {
  const colMin = compact ? "minmax(140px, 1fr)" : "minmax(220px, 1fr)";
  const template = { gridTemplateColumns: `56px repeat(${Math.max(columns.length, 1)}, ${colMin})` };

  const byCell = columns.map((col) => {
    const cells = new Map<number, AgendaItem[]>();
    const unscheduled: AgendaItem[] = [];
    for (const item of col.items) {
      const row = slotRowFor(item.time);
      if (row == null) unscheduled.push(item);
      else cells.set(row, [...(cells.get(row) ?? []), item]);
    }
    return { cells, unscheduled };
  });
  const hasUnscheduled = byCell.some((c) => c.unscheduled.length > 0);

  return (
    <div className="overflow-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="grid min-w-fit" style={template}>
        {/* Cabeçalho */}
        <div className="sticky top-0 z-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" />
        {columns.map((col) => (
          <div
            key={col.id}
            className={`sticky top-0 z-20 border-b border-l border-slate-200 dark:border-slate-800 px-3 py-2 ${
              col.highlight ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-white dark:bg-slate-900"
            }`}
          >
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{col.label}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {col.sublabel ?? `${col.items.length} ${col.items.length === 1 ? "paciente" : "pacientes"}`}
            </p>
          </div>
        ))}

        {/* Sem horário / fora da grade (ordem de chegada) */}
        {hasUnscheduled && (
          <>
            <div className="border-b border-slate-200 dark:border-slate-800 px-1 py-2 text-[10px] leading-tight text-slate-500 dark:text-slate-400 text-right">
              Sem horário
            </div>
            {byCell.map((c, i) => (
              <div key={columns[i].id} className="border-b border-l border-slate-200 dark:border-slate-800 p-1 space-y-1 bg-slate-50/60 dark:bg-slate-950/40">
                {c.unscheduled.map((item) => (
                  <AppointmentCard key={item.key} item={item} compact={compact} onOpen={onOpen} onSetStatus={onSetStatus} />
                ))}
              </div>
            ))}
          </>
        )}

        {Array.from({ length: AGENDA_ROWS }, (_, row) => {
          const time = rowToTime(row);
          const isHour = time.endsWith(":00");
          const line = isHour ? "border-slate-200 dark:border-slate-800" : "border-slate-100 dark:border-slate-800/50";
          return (
            <div key={row} className="contents">
              <div className={`border-t ${line} pr-2 text-right text-[10px] tabular-nums text-slate-400 dark:text-slate-500 -mt-px`}>
                {isHour ? time : ""}
              </div>
              {byCell.map((c, i) => {
                const items = c.cells.get(row) ?? [];
                const col = columns[i];
                return (
                  <div key={col.id} className={`group/cell relative border-t border-l ${line} min-h-7 p-0.5 space-y-0.5`}>
                    {items.map((item) => (
                      <AppointmentCard key={item.key} item={item} compact={compact} onOpen={onOpen} onSetStatus={onSetStatus} />
                    ))}
                    {items.length === 0 && (
                      <button
                        type="button"
                        onClick={() => onSlotClick(col, time)}
                        className="absolute inset-0 flex items-center gap-1 px-2 text-[11px] font-medium text-emerald-700 dark:text-emerald-400 opacity-0 hover:opacity-100 focus-visible:opacity-100 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 focus:outline-none"
                        aria-label={`Novo agendamento às ${time}${col.doctor ? ` com ${col.doctor}` : ""}`}
                      >
                        <Plus className="w-3 h-3" aria-hidden /> {time}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
