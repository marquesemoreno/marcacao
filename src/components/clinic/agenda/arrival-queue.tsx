"use client";

import { useEffect, useState } from "react";
import { Check, Clock, UserRound } from "lucide-react";
import { arrivalQueue, type AgendaItem } from "@/lib/agenda";
import { toTitleCase } from "@/lib/agenda-ui";

/** Fila de chegada (Agenda, só no dia de hoje): quem a recepção marcou "Chegou", em ordem
 * de chegada, com o tempo de espera e a posição na fila do médico. "Atendido" tira da fila. */
export function ArrivalQueue({
  items,
  date,
  onDone,
  onOpen,
}: {
  items: AgendaItem[];
  date: string;
  onDone: (item: AgendaItem) => void;
  onOpen: (item: AgendaItem) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const queue = arrivalQueue(items, date, now);
  if (queue.length === 0) return null;
  const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <section aria-labelledby="fila-chegada" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
      <h2 id="fila-chegada" className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold">
        <UserRound className="h-4 w-4 text-sky-600" aria-hidden />
        Fila de chegada
        <span className="text-xs font-normal text-slate-500 tabular-nums">{queue.length} na recepção</span>
      </h2>
      <ol className="divide-y divide-slate-100 dark:divide-slate-800">
        {queue.map(({ item, position, waitingMin }) => (
          <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left hover:underline underline-offset-2">
              <span className="font-medium">{toTitleCase(item.patientName || "Paciente")}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {item.doctor ? toTitleCase(item.doctor) : "Sem médico"} · {position}º da fila · chegou {fmt.format(new Date(item.arrivedAt!))}
                {item.time ? ` · marcado ${item.time}` : " · ordem de chegada"}
              </span>
            </button>
            <span
              className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${
                waitingMin > 60
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                  : waitingMin > 30
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
              }`}
            >
              <Clock className="h-3 w-3" aria-hidden /> esperando {waitingMin} min
            </span>
            <button
              type="button"
              onClick={() => onDone(item)}
              className="inline-flex h-8 items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-700 px-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
            >
              <Check className="h-3.5 w-3.5" aria-hidden /> Atendido
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
