"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import { collapseEmptyRows, rowToTime, slotRowFor, visibleRowRange, type AgendaItem, type AgendaStatusChoice } from "@/lib/agenda";
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
  onReschedule,
}: {
  columns: AgendaColumn[];
  compact?: boolean;
  /** HH:MM de agora quando a grade inclui hoje — desenha a linha "agora". */
  nowTime?: string | null;
  onSlotClick: (column: AgendaColumn, time?: string) => void;
  onOpen: (item: AgendaItem) => void;
  onSetStatus: (item: AgendaItem, status: AgendaStatusChoice) => Promise<void>;
  onReschedule: (item: AgendaItem) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Faixas "livre" que a recepção abriu pra marcar (chave = 1ª linha da faixa).
  const [openedGaps, setOpenedGaps] = useState<Set<number>>(new Set());
  // Toque (tablet, sem hover): 1º toque mostra "+ HH:MM", 2º abre o agendamento — um toque
  // perdido na grade não abre mais "Novo agendamento" (crítica 02/11, 5ª).
  const [armed, setArmed] = useState<string | null>(null);
  const noHover = typeof window !== "undefined" && window.matchMedia?.("(hover: none)").matches;
  const nowRef = useRef<HTMLDivElement>(null);
  const colMin = compact ? "minmax(132px, 1fr)" : "minmax(230px, 1fr)";
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
  // Crítica 02/11: scrollIntoView rolava a página inteira a cada 15 min. Agora rola só a
  // caixa da grade, e só quando o conjunto de colunas muda (abrir/trocar período).
  const scrollRef = useRef<HTMLDivElement>(null);
  const colsKey = columns.map((c) => c.id).join("|");
  useEffect(() => {
    const box = scrollRef.current;
    const now = nowRef.current;
    if (!box || !now) return;
    box.scrollTop = Math.max(0, now.offsetTop - box.clientHeight / 2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colsKey]);

  // Crítica 9ª: o calc fixo passava da tela (811×631) ou deixava a página rolar junto (1440).
  // No desktop a caixa vai do topo dela até o fim da janela.
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return;
    const fit = () => {
      if (window.innerWidth < 1024) return void (box.style.height = "");
      const top = box.getBoundingClientRect().top + window.scrollY;
      box.style.height = `${Math.max(224, window.innerHeight - top - 16)}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);

  const rows: number[] = [];
  for (let r = firstRow; r <= lastRow; r++) rows.push(r);
  const occupied = new Set(byCell.flatMap((c) => [...c.cells.keys()]));
  const segments = collapseEmptyRows(rows, occupied, nowRow != null ? new Set([nowRow]) : new Set(), openedGaps);

  return (
    <div ref={scrollRef} className="relative h-[70dvh] min-h-[14rem] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <div className="grid min-w-fit" style={template}>
        {/* Cabeçalho */}
        <div className="sticky top-0 left-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800" />
        {columns.map((col) => (
          <div
            key={col.id}
            className={`sticky top-0 z-20 flex items-start justify-between gap-2 border-b border-l border-slate-200 dark:border-slate-800 px-3 py-2 ${
              col.highlight ? "bg-emerald-50 dark:bg-emerald-950" : "bg-white dark:bg-slate-900"
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
              className="shrink-0 inline-flex size-9 items-center justify-center rounded-md text-slate-600 dark:text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
              aria-label={`Novo agendamento — ${col.label}`}
              title="Novo agendamento"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        ))}

        {hasUnscheduled && (
          <>
            <div className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 pr-2 py-2 text-xs leading-tight text-slate-500 dark:text-slate-400 text-right">
              Sem horário
            </div>
            {byCell.map((c, i) => (
              <div key={columns[i].id} className="border-b border-l border-slate-200 dark:border-slate-800 p-1 space-y-1 bg-slate-50/70 dark:bg-slate-950/40">
                {c.unscheduled.map((item) => (
                  <AppointmentCard key={item.key} item={item} compact={compact} nowTime={nowTime} onOpen={onOpen} onSetStatus={onSetStatus} onReschedule={onReschedule} />
                ))}
              </div>
            ))}
          </>
        )}

        {segments.map((seg, si) => {
          if (seg.type === "gap") {
            const from = rowToTime(seg.from);
            const to = rowToTime(seg.to + 1);
            return (
              <div key={`gap-${seg.from}`} className="contents">
                {/* Sem rótulo de hora aqui: o intervalo já está na faixa (crítica 7ª). */}
                <div className="sticky left-0 z-10 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800" />
                <div style={{ gridColumn: "2 / -1" }} className="border-t border-l border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
                  <button
                    type="button"
                    onClick={() => setOpenedGaps((prev) => new Set(prev).add(seg.from))}
                    className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-xs text-slate-600 dark:text-slate-400 hover:bg-emerald-50/70 hover:text-emerald-800 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500/50"
                    aria-label={`Horário livre das ${from} às ${to}: mostrar horários para marcar`}
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="tabular-nums">
                      {from}–{to} · livre
                    </span>
                    <span className="ml-auto font-medium">Mostrar horários</span>
                  </button>
                </div>
              </div>
            );
          }
          const row = seg.row;
          const time = rowToTime(row);
          // Depois de uma faixa livre a hora sempre aparece (senão "13:45" ficava sem rótulo).
          const afterGap = si === 0 || segments[si - 1].type === "gap";
          const isHour = time.endsWith(":00") || afterGap;
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
                className={`sticky left-0 z-10 bg-white dark:bg-slate-900 border-t ${line} pr-2 text-right text-xs tabular-nums ${
                  isNow ? "font-semibold text-emerald-700 dark:text-emerald-400" : "text-slate-600 dark:text-slate-400"
                }`}
              >
                {isNow ? (
                  <>
                    {time}
                    <span className="block text-[11px]">agora</span>
                  </>
                ) : isHour ? (
                  time
                ) : (
                  ""
                )}
              </div>
              {byCell.map((c, i) => {
                const col = columns[i];
                const items = c.cells.get(row) ?? [];
                const cellKey = `${col.id}|${row}`;
                // Crítica 8ª: o "+6 às 07:00" escondia justo o pico. Perto de agora (±1 h) mostra todos.
                const nearNow = nowRow != null && Math.abs(row - nowRow) <= 4;
                // Outro dia (planejando amanhã): até 10 no horário, mostra todos (crítica 9ª).
                const showAll = nearNow || (nowRow == null && items.length <= 10) || expanded.has(cellKey);
                const shown = showAll ? items : items.slice(0, CELL_LIMIT);
                const hidden = items.length - shown.length;
                return (
                  <div key={col.id} className={`group/cell relative border-t border-l ${line} min-h-8 [@media(hover:none)]:min-h-9 p-0.5 space-y-0.5`}>
                    {shown.map((item) => (
                      <AppointmentCard key={item.key} item={item} compact={compact} nowTime={nowTime} onOpen={onOpen} onSetStatus={onSetStatus} onReschedule={onReschedule} />
                    ))}
                    {hidden > 0 && (
                      <button
                        type="button"
                        onClick={() => setExpanded((prev) => new Set(prev).add(cellKey))}
                        className="w-full min-h-8 rounded-md px-2 py-1 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                      >
                        +{hidden} {hidden === 1 ? "paciente" : "pacientes"} às {time}
                      </button>
                    )}
                    {items.length === 0 ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => {
                          if (noHover && armed !== cellKey) return setArmed(cellKey);
                          setArmed(null);
                          onSlotClick(col, time);
                        }}
                        className={`absolute inset-0 flex items-center gap-1 px-2 text-xs font-medium text-emerald-700 dark:text-emerald-400 ${armed === cellKey ? "opacity-100 bg-emerald-50/70 dark:bg-emerald-950/30" : "opacity-0"} hover:opacity-100 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/30 focus:outline-none`}
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
                        className="absolute right-1 top-1 z-10 hidden group-hover/cell:inline-flex [@media(hover:none)]:!hidden size-6 items-center justify-center rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-emerald-700 dark:text-emerald-400 shadow-xs"
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
