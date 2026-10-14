"use client";

import { useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { rowToTime, slotRowFor, visibleRowRange, type AgendaItem, type AgendaStatusChoice } from "@/lib/agenda";
import { AppointmentCard } from "./appointment-card";

export type AgendaColumn = { id: string; label: string; sublabel?: string; date: string; doctor: string | null; items: AgendaItem[]; highlight?: boolean };

/** Quantos cards uma célula de 15 min mostra antes do "+N". */
const CELL_LIMIT = 3;

/** Grade de horários em linhas de 15 min, uma coluna por dia (Semana) ou por médico.
 * Mostra só do primeiro ao último paciente (mais a hora atual, se for hoje) — a agenda
 * típica tem ~24 pacientes e 48 linhas vazias só atrapalham. Sem posição absoluta: a
 * ponte não informa a hora de fim, então cada célula empilha as marcações do intervalo.
 * Horário vazio fica fora do Tab (seriam centenas de paradas); pelo teclado, o "+" no
 * cabeçalho da coluna abre o Novo Agendamento. */
export function AgendaGrid({
  columns,
  compact = false,
  nowTime,
  onSlotClick,
  onOpen,
  onSetStatus,
}: {
  columns: AgendaColumn[];
  compact?: boolean;
  /** HH:MM de agora quando a grade inclui hoje — desenha a linha "agora". */
  nowTime?: string | null;
  onSlotClick: (column: AgendaColumn, time?: string) => void;
  onOpen: (item: AgendaItem) => void;
  onSetStatus: (item: AgendaItem, status: AgendaStatusChoice) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const nowRef = useRef<HTMLDivElement>(null);
  const colMin = compact ? "minmax(150px, 1fr)" : "minmax(230px, 1fr)";
  const template = { gridTemplateColumns: `52px repeat(${Math.max(columns.length, 1)}, ${colMin})` };

  const allItems = columns.flatMap((c) => c.items);
  const [firstRow, lastRow] = visibleRowRange(allItems, nowTime);
  const nowRow = slotRowFor(nowTime ?? null);

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

  // Abre já na hora atual (o pico da recepção é "quem chega agora").
  useEffect(() => {
    nowRef.current?.scrollIntoView({ block: "center" });
  }, [nowRow, columns.length]);

  const rows: number[] = [];
  for (let r = firstRow; r <= lastRow; r++) rows.push(r);

  return (
    <div className="max-h-[calc(100vh-15rem)] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="grid min-w-fit" style={template}>
        {/* Cabeçalho */}
        <div className="sticky top-0 left-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" />
        {columns.map((col) => (
          <div
            key={col.id}
            className={`sticky top-0 z-20 flex items-start justify-between gap-2 border-b border-l border-slate-200 dark:border-slate-800 px-3 py-2 ${
              col.highlight ? "bg-emerald-50 dark:bg-emerald-950/40" : "bg-white dark:bg-slate-900"
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{col.label}</p>
              <p className={`text-xs tabular-nums ${col.highlight ? "text-emerald-800 dark:text-emerald-300" : "text-slate-500 dark:text-slate-400"}`}>
                {col.sublabel ?? `${col.items.length} ${col.items.length === 1 ? "paciente" : "pacientes"}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onSlotClick(col)}
              className="shrink-0 inline-flex size-7 items-center justify-center rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              aria-label={`Novo agendamento — ${col.label}`}
              title="Novo agendamento"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ))}

        {hasUnscheduled && (
          <>
            <div className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pr-2 py-2 text-[11px] leading-tight text-slate-500 dark:text-slate-400 text-right">
              Sem horário
            </div>
            {byCell.map((c, i) => (
              <div key={columns[i].id} className="border-b border-l border-slate-200 dark:border-slate-800 p-1 space-y-1 bg-slate-50/70 dark:bg-slate-950/40">
                {c.unscheduled.map((item) => (
                  <AppointmentCard key={item.key} item={item} compact={compact} onOpen={onOpen} onSetStatus={onSetStatus} />
                ))}
              </div>
            ))}
          </>
        )}

        {rows.map((row) => {
          const time = rowToTime(row);
          const isHour = time.endsWith(":00");
          const isNow = row === nowRow;
          const line = isNow
            ? "border-emerald-500 dark:border-emerald-400"
            : isHour
              ? "border-slate-200 dark:border-slate-800"
              : "border-slate-100 dark:border-slate-800/50";
          return (
            <div key={row} className="contents">
              <div
                ref={isNow ? nowRef : undefined}
                className={`sticky left-0 z-10 bg-white dark:bg-slate-900 border-t ${line} pr-2 text-right text-[11px] tabular-nums ${
                  isNow ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-slate-400 dark:text-slate-500"
                }`}
              >
                {isNow ? "agora" : isHour ? time : ""}
              </div>
              {byCell.map((c, i) => {
                const col = columns[i];
                const items = c.cells.get(row) ?? [];
                const cellKey = `${col.id}|${row}`;
                const showAll = expanded.has(cellKey);
                const shown = showAll ? items : items.slice(0, CELL_LIMIT);
                const hidden = items.length - shown.length;
                return (
                  <div key={col.id} className={`group/cell relative border-t border-l ${line} min-h-8 p-0.5 space-y-0.5`}>
                    {shown.map((item) => (
                      <AppointmentCard key={item.key} item={item} compact={compact} onOpen={onOpen} onSetStatus={onSetStatus} />
                    ))}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => new Set(prev).add(cellKey))}
                        className="w-full rounded-md px-2 py-1 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      >
                        +{hidden} {hidden === 1 ? "paciente" : "pacientes"} às {time}
                      </button>
                    )}
                    {items.length === 0 ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onSlotClick(col, time)}
                        className="absolute inset-0 flex items-center gap-1 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 opacity-0 hover:opacity-100 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 focus:outline-none"
                        aria-label={`Novo agendamento às ${time}`}
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden /> {time}
                      </button>
                    ) : (
                      // Encaixe: horário já ocupado ainda aceita outro paciente.
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onSlotClick(col, time)}
                        className="absolute right-1 top-1 z-10 hidden group-hover/cell:inline-flex size-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
                        aria-label={`Encaixar paciente às ${time}`}
                        title={`Encaixar às ${time}`}
                      >
                        <Plus className="w-3.5 h-3.5" aria-hidden />
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
