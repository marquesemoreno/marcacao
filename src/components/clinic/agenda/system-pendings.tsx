"use client";

import { ClipboardList } from "lucide-react";
import type { AgendaItem } from "@/lib/agenda";
import { toTitleCase } from "@/lib/agenda-ui";

/** Crítica 02/11: cancelar no Conecta não cancela no sistema da clínica, e o lembrete disso
 * era um toast de 8 s. Esta lista fica até a marcação sumir da ponte (= cancelada lá). */
export function SystemPendings({ items, onOpen }: { items: AgendaItem[]; onOpen: (item: AgendaItem) => void }) {
  if (items.length === 0) return null;
  return (
    <details className="group rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/60 dark:bg-amber-950/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
        <ClipboardList className="h-4 w-4" aria-hidden />
        {items.length} {items.length === 1 ? "cancelamento falta" : "cancelamentos faltam"} no sistema da clínica
        <span className="ml-auto text-xs font-normal group-open:hidden">ver</span>
      </summary>
      <div className="border-t border-amber-200 dark:border-amber-800 px-4 py-2">
        <p className="text-xs text-amber-900/80 dark:text-amber-200/80">
          Foram cancelados só no Conecta. Cancele também no sistema da clínica — cada um sai daqui sozinho quando isso for feito.
        </p>
        <ul className="mt-1 divide-y divide-amber-200/70 dark:divide-amber-800/60">
          {items.map((i) => (
            <li key={i.key}>
              <button type="button" onClick={() => onOpen(i)} className="w-full py-1.5 text-left text-sm underline-offset-2 hover:underline">
                <span className="font-medium">{toTitleCase(i.patientName || "Paciente")}</span>
                <span className="text-xs tabular-nums text-slate-600 dark:text-slate-300">
                  {" "}
                  · {i.date.split("-").reverse().join("/").slice(0, 5)}
                  {i.time ? ` ${i.time}` : ""}
                  {i.doctor ? ` · ${toTitleCase(i.doctor)}` : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
