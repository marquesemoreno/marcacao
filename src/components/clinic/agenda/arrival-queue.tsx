"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardCheck, Clock, Loader2, Megaphone, Stethoscope, UserRound } from "lucide-react";
import { toast } from "sonner";
import { callPatientOnTv } from "@/actions/tv-call";
import { arrivalQueue, type AgendaItem } from "@/lib/agenda";
import { toTitleCase } from "@/lib/agenda-ui";

/** Torre da recepção (Agenda, dia de hoje): "Aguardando" = quem chegou (pela recepção ou
 * pelo "Cheguei" do celular), em ordem de chegada por médico; "Chamar" passa pra "Em
 * atendimento"; "Atendido" encerra. Fase 3 da jornada do paciente (02/11/2026). */
export function ArrivalQueue({
  items,
  date,
  onSetStatus,
  onOpen,
}: {
  items: AgendaItem[];
  date: string;
  onSetStatus: (item: AgendaItem, status: "IN_ROOM" | "COMPLETED") => Promise<unknown>;
  onOpen: (item: AgendaItem) => void;
}) {
  const [now, setNow] = useState(() => new Date());
  // Crítica 02/11: "Atendido" sem estado de envio — toque duplo no balcão disparava duas vezes.
  const [saving, setSaving] = useState<Set<string>>(() => new Set());
  const act = async (item: AgendaItem, status: "IN_ROOM" | "COMPLETED") => {
    if (saving.has(item.key)) return;
    setSaving((s) => new Set(s).add(item.key));
    try {
      await onSetStatus(item, status);
      // "Chamar" também anuncia na TV da sala de espera (se a clínica tiver uma).
      if (status === "IN_ROOM") await announce(item);
    } catch {
      // o toast de erro já sai em handleSetStatus
    } finally {
      setSaving((s) => {
        const n = new Set(s);
        n.delete(item.key);
        return n;
      });
    }
  };
  async function announce(item: AgendaItem) {
    try {
      await callPatientOnTv({ source: item.source, externalId: item.externalId, patientName: item.patientName, doctor: item.doctor });
    } catch {
      toast.error("Não deu pra anunciar na TV — o status foi salvo.");
    }
  }
  const recall = async (item: AgendaItem) => {
    if (saving.has(item.key)) return;
    setSaving((s) => new Set(s).add(item.key));
    await announce(item);
    toast.success(`${toTitleCase(item.patientName || "Paciente")} chamado de novo na TV`);
    setSaving((s) => {
      const n = new Set(s);
      n.delete(item.key);
      return n;
    });
  };
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const queue = arrivalQueue(items, date, now);
  const inRoom = items.filter((i) => i.date === date && i.status === "IN_ROOM");
  if (queue.length === 0 && inRoom.length === 0) return null;
  const fmt = new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <section aria-labelledby="fila-chegada" className="glass-surface overflow-hidden">
      <h2 id="fila-chegada" className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 px-4 py-2.5 text-sm font-semibold">
        <UserRound className="h-4 w-4 text-sky-600" aria-hidden />
        Recepção agora
        <span className="text-xs font-normal text-slate-500 tabular-nums">
          {queue.length} aguardando · {inRoom.length} em atendimento
        </span>
      </h2>
      {queue.length > 0 && <h3 className="px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Aguardando</h3>}
      <ol className="divide-y divide-slate-100 dark:divide-slate-800">
        {queue.map(({ item, position, waitingMin, lateMin }) => (
          <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
            <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 rounded text-left hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
              <span className="font-medium">{toTitleCase(item.patientName || "Paciente")}</span>
              {item.formDone && (
                <ClipboardCheck className="ml-1 inline h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" role="img" aria-label="Ficha prévia enviada" />
              )}
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {item.doctor ? toTitleCase(item.doctor) : "Sem médico"} · {position}º da fila · chegou {fmt.format(new Date(item.arrivedAt!))}
                {item.time ? ` · marcado ${item.time}` : " · ordem de chegada"}
              </span>
            </button>
            {/* Atraso conta do horário marcado; quem chegou adiantado só "espera". Sem horário
                (ordem de chegada), a espera longa é o que alerta. */}
            {(() => {
              const late = lateMin ?? (waitingMin > 30 ? waitingMin - 30 : 0);
              const tone =
                late > 30
                  ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300"
                  : late > 15
                    ? "bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300";
              return (
                <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold tabular-nums ${tone}`}>
                  <Clock className="h-3 w-3" aria-hidden /> esperando {waitingMin} min
                  {lateMin !== null && lateMin > 15 ? ` · ${lateMin} min após o horário` : ""}
                </span>
              );
            })()}
            <button
              type="button"
              onClick={() => void act(item, "IN_ROOM")}
              disabled={saving.has(item.key)}
              aria-busy={saving.has(item.key)}
              className="inline-flex h-9 disabled:opacity-60 items-center gap-1 rounded-md bg-indigo-600 px-2.5 text-xs font-semibold text-white hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            >
              {saving.has(item.key) ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Stethoscope className="h-3.5 w-3.5" aria-hidden />} Chamar
            </button>
          </li>
        ))}
      </ol>
      {inRoom.length > 0 && (
        <>
          <h3 className="border-t border-slate-100 dark:border-slate-800 px-4 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Em atendimento</h3>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {inRoom.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm">
                <button type="button" onClick={() => onOpen(item)} className="min-w-0 flex-1 rounded text-left hover:underline underline-offset-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50">
                  <span className="font-medium">{toTitleCase(item.patientName || "Paciente")}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{item.doctor ? toTitleCase(item.doctor) : "Sem médico"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => void recall(item)}
                  disabled={saving.has(item.key)}
                  className="inline-flex h-9 disabled:opacity-60 items-center gap-1 rounded-md border border-slate-300 dark:border-slate-700 px-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                  title="Anunciar de novo na TV da sala de espera"
                >
                  <Megaphone className="h-3.5 w-3.5" aria-hidden /> Chamar de novo
                </button>
                <button
                  type="button"
                  onClick={() => void act(item, "COMPLETED")}
                  disabled={saving.has(item.key)}
                  aria-busy={saving.has(item.key)}
                  className="inline-flex h-9 disabled:opacity-60 items-center gap-1 rounded-md border border-emerald-300 dark:border-emerald-700 px-2.5 text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
                >
                  {saving.has(item.key) ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Check className="h-3.5 w-3.5" aria-hidden />} Atendido
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
