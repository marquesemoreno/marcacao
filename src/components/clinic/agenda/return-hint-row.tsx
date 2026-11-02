"use client";

import { useEffect, useState } from "react";
import { getAgendaReturnHint } from "@/actions/return-intervals";
import type { AgendaItem } from "@/lib/agenda";

type Hint = Awaited<ReturnType<typeof getAgendaReturnHint>>;

/** "Retorno sugerido" no painel do paciente: intervalo do procedimento, senão do médico,
 * senão o padrão da régua (configurado em Retorno). */
export function ReturnHintRow({ item }: { item: AgendaItem }) {
  const [hint, setHint] = useState<Hint | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    setHint(undefined);
    getAgendaReturnHint({ source: item.source, externalId: item.externalId, date: item.date, doctor: item.doctor })
      .then((h) => alive && setHint(h))
      .catch(() => alive && setHint(null));
    return () => {
      alive = false;
    };
  }, [item.key, item.source, item.externalId, item.date, item.doctor]);
  if (!hint) return null;
  const due = new Date(`${hint.due}T12:00:00Z`).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  return (
    <p className="flex justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">Retorno sugerido</span>
      <span className="text-right font-medium text-slate-800 dark:text-slate-100">
        {due} <span className="text-xs text-slate-500">({hint.days} dias{hint.isDefault ? ", padrão" : ""})</span>
      </span>
    </p>
  );
}
