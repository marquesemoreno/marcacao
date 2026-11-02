"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList } from "lucide-react";
import type { AgendaItem } from "@/lib/agenda";
import { toTitleCase } from "@/lib/agenda-ui";

const DONE_KEY = "agenda:faltas-ajustadas";

/** Faltas continuam vindo pela ponte mesmo depois de registradas lá — a recepção marca
 * "Feito". Fica neste computador (sem coluna no banco). */
function readDone(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DONE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Crítica 02/11: cancelar no Conecta não cancela no sistema da clínica, e o lembrete disso
 * era um toast de 8 s. Esta lista fica até a marcação sumir da ponte (= cancelada lá). */
export function SystemPendings({ items: all, onOpen }: { items: AgendaItem[]; onOpen: (item: AgendaItem) => void }) {
  const [done, setDone] = useState<string[]>([]);
  useEffect(() => setDone(readDone()), []);
  const markDone = (key: string) => {
    const next = [...new Set([...done, key])].slice(-300);
    setDone(next);
    try {
      localStorage.setItem(DONE_KEY, JSON.stringify(next));
    } catch {}
  };
  const items = all.filter((i) => !(i.status === "NO_SHOW" && done.includes(i.key)));
  if (items.length === 0) return null;
  return (
    <details className="group rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
        <ClipboardList className="h-4 w-4" aria-hidden />
        {items.length} {items.length === 1 ? "ajuste falta" : "ajustes faltam"} no sistema da clínica
        <span className="ml-auto text-xs font-normal group-open:hidden">ver</span>
      </summary>
      <div className="border-t border-amber-200 dark:border-amber-800 px-4 py-2">
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
          Marcados só no Conecta. Cancelamentos saem daqui sozinhos quando forem feitos no sistema da clínica; faltas, marque
          “Feito” depois de registrar lá.
        </p>
        <ul className="mt-1 divide-y divide-amber-200/70 dark:divide-amber-800/60">
          {items.map((i) => (
            <li key={i.key} className="flex items-center gap-2">
              <button type="button" onClick={() => onOpen(i)} className="min-w-0 flex-1 py-1.5 text-left text-sm underline-offset-2 hover:underline">
                <span className="mr-1 text-xs font-semibold uppercase text-amber-800 dark:text-amber-300">{i.status === "NO_SHOW" ? "Falta" : "Cancelar"}</span>
                <span className="font-medium">{toTitleCase(i.patientName || "Paciente")}</span>
                <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {" "}
                  · {i.date.split("-").reverse().join("/").slice(0, 5)}
                  {i.time ? ` ${i.time}` : ""}
                  {i.doctor ? ` · ${toTitleCase(i.doctor)}` : ""}
                </span>
              </button>
              {i.status === "NO_SHOW" && (
                <button
                  type="button"
                  onClick={() => markDone(i.key)}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-amber-300 dark:border-amber-700 px-2 text-xs font-semibold text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  <Check className="h-3 w-3" aria-hidden /> Feito
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
