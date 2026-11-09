"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Megaphone, RotateCcw, Ticket } from "lucide-react";
import { toast } from "sonner";
import { callTicket, getQueue, getQueueServices, setTicketStatus } from "@/actions/queue-ticket";
import type { QueueServiceView } from "@/lib/queue-ticket-server";
import type { QueueTicketView } from "@/lib/queue-ticket-server";
import { toTitleCase } from "@/lib/agenda-ui";

const POLL_MS = 10_000;
const ROOM_KEY = "senhas.room";
const SERVICES_KEY = "senhas.services";
const input = "h-10 rounded-full border border-transparent bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 px-4 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
const ghost = "inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium hover:bg-slate-900/5 disabled:opacity-40 dark:hover:bg-white/10";

function waitOrder(list: QueueTicketView[]) {
  const age = (a: QueueTicketView, b: QueueTicketView) => a.createdAt.localeCompare(b.createdAt);
  const waiting = list.filter((t) => t.status === "WAITING");
  return [...waiting.filter((t) => t.type === "P").sort(age), ...waiting.filter((t) => t.type === "N").sort(age)];
}

function minutesSince(iso: string) {
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
}

/** Fila do totem: "Chamar próxima" (preferencial primeiro), rechamar, concluir.
 * `compact` = cartão na tela do médico (sem a lista de espera completa). */
export function QueuePanel({ initial, compact = false, defaultRoom = "" }: { initial?: QueueTicketView[]; compact?: boolean; defaultRoom?: string }) {
  const [list, setList] = useState<QueueTicketView[]>(initial ?? []);
  const [room, setRoom] = useState(defaultRoom);
  const [pending, start] = useTransition();
  const [services, setServices] = useState<QueueServiceView[]>([]);
  /** Serviços que este guichê atende (vazio = todos). Fica salvo no computador. */
  const [mine, setMine] = useState<string[]>([]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROOM_KEY);
      if (saved) setRoom(saved);
      setMine(JSON.parse(localStorage.getItem(SERVICES_KEY) ?? "[]"));
    } catch {}
    getQueueServices().then(setServices).catch(() => {});
  }, []);
  const toggleMine = (id: string) =>
    setMine((cur) => {
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      try {
        localStorage.setItem(SERVICES_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  const inMine = (t: QueueTicketView) => mine.length === 0 || (!!t.serviceId && mine.includes(t.serviceId));
  const saveRoom = (v: string) => {
    setRoom(v);
    try {
      localStorage.setItem(ROOM_KEY, v);
    } catch {}
  };

  const refresh = useCallback(async () => {
    try {
      setList(await getQueue());
    } catch {}
  }, []);
  useEffect(() => {
    if (!initial) void refresh();
    const id = setInterval(() => document.visibilityState === "visible" && void refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [initial, refresh]);

  const act = (fn: () => Promise<unknown>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu certo.");
      }
      await refresh();
    });

  const call = (ticketId?: string) =>
    act(async () => {
      if (!room.trim()) throw new Error("Informe o guichê ou a sala antes de chamar.");
      const res = await callTicket({ ticketId, room, serviceIds: ticketId ? null : mine.length ? mine : null });
      if (!res) toast.info("Ninguém esperando.");
      else toast.success(`${res.code} chamada na TV`);
    });

  const waiting = waitOrder(list.filter(inMine));
  const called = list.filter((t) => t.status === "CALLED").sort((a, b) => (b.calledAt ?? "").localeCompare(a.calledAt ?? ""));
  const done = list.filter((t) => t.status === "DONE").length;
  const pCount = waiting.filter((t) => t.type === "P").length;

  return (
    <div className="space-y-4">
      <section className="glass-surface relative overflow-hidden p-5">
        <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/15" />
        <div aria-hidden className="pointer-events-none absolute -bottom-24 left-1/3 size-56 rounded-full bg-sky-300/25 blur-3xl dark:bg-sky-500/10" />
        {!compact && called[0] && (
          <div className="relative mb-4 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Chamando agora</span>
            <span className="font-mono text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">{called[0].code}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {called[0].patientName ? toTitleCase(called[0].patientName) : "Sem agendamento"} · {called[0].room ?? "recepção"}
            </span>
          </div>
        )}
        <div className="relative flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Guichê / sala
            <input value={room} onChange={(e) => saveRoom(e.target.value)} placeholder="ex.: Guichê 1" maxLength={40} className={`${input} w-44`} />
          </label>
          <button
            type="button"
            disabled={pending || waiting.length === 0}
            onClick={() => call()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-emerald-600 px-5 text-base font-semibold text-white shadow-[0_10px_20px_-10px_rgb(5_150_105/0.9)] hover:bg-emerald-700 disabled:bg-slate-300 disabled:shadow-none dark:disabled:bg-slate-700"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Megaphone className="h-5 w-5" aria-hidden />}
            Chamar próxima{waiting[0] ? ` (${waiting[0].code})` : ""}
          </button>
          {services.filter((sv) => sv.active).length > 1 && (
            <fieldset className="flex flex-wrap items-center gap-1.5">
              <legend className="sr-only">Serviços que este guichê atende</legend>
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Atendo:</span>
              {services
                .filter((sv) => sv.active)
                .map((sv) => {
                  const on = mine.includes(sv.id);
                  return (
                    <button
                      key={sv.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleMine(sv.id)}
                      className={`h-8 rounded-full border px-3 text-xs font-medium ${on ? "border-transparent bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "border-transparent bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 text-slate-600 dark:text-slate-300"}`}
                    >
                      {sv.name}
                    </button>
                  );
                })}
              {mine.length === 0 && <span className="text-xs text-slate-500">todos</span>}
            </fieldset>
          )}
          <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            <strong className="text-slate-900 dark:text-slate-100">{waiting.length}</strong> esperando
            {pCount > 0 && <> · {pCount} preferencial</>}
            {!compact && <> · {done} atendidas hoje</>}
          </p>
        </div>
      </section>

      {called.length > 0 && (
        <section aria-labelledby="q-called">
          <h2 id="q-called" className="mb-2 text-base font-semibold tracking-tight">Chamadas</h2>
          <ul className="glass-surface overflow-hidden divide-y divide-slate-900/[0.05] dark:divide-white/[0.06]">
            {called.slice(0, compact ? 3 : 20).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-white/50 dark:hover:bg-white/[0.03]">
                <Code t={t} />
                <span className="min-w-0 flex-1 truncate">
                  {t.patientName ? toTitleCase(t.patientName) : <span className="text-slate-500">Sem agendamento</span>}
                  <span className="text-xs text-slate-500"> · {t.room ?? "recepção"}{t.callCount > 1 ? ` · chamada ${t.callCount}×` : ""}</span>
                </span>
                <button type="button" disabled={pending} onClick={() => call(t.id)} className={ghost}><RotateCcw className="h-3.5 w-3.5" aria-hidden /> Chamar de novo</button>
                <button type="button" disabled={pending} onClick={() => act(() => setTicketStatus(t.id, "DONE"))} className={`${ghost} text-emerald-700 dark:text-emerald-300`}>Atendida</button>
                <button type="button" disabled={pending} onClick={() => act(() => setTicketStatus(t.id, "NO_SHOW"))} className={`${ghost} text-rose-700 dark:text-rose-300`}>Não veio</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!compact && (
        <section aria-labelledby="q-waiting">
          <h2 id="q-waiting" className="mb-2 text-base font-semibold tracking-tight">Esperando <span className="text-sm font-normal text-slate-500 dark:text-slate-400">(ordem de chamada)</span></h2>
          {waiting.length === 0 ? (
            <p className="glass-surface border border-dashed border-slate-300 p-5 text-sm text-slate-500 dark:border-white/15">
              Ninguém na fila. As senhas aparecem aqui quando o paciente tira no totem.
            </p>
          ) : (
            <ul className="glass-surface overflow-hidden divide-y divide-slate-900/[0.05] dark:divide-white/[0.06]">
              {waiting.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm transition-colors hover:bg-white/50 dark:hover:bg-white/[0.03]">
                  <Code t={t} />
                  <span className="min-w-0 flex-1 truncate">
                    {t.patientName ? (
                      <>
                        {toTitleCase(t.patientName)}
                        <span className="text-xs text-slate-500">
                          {t.appointmentTime ? ` · ${t.appointmentTime}` : ""}
                          {t.doctor ? ` · ${toTitleCase(t.doctor)}` : ""}
                        </span>
                      </>
                    ) : (
                      <span className="text-slate-500">Sem agendamento</span>
                    )}
                  </span>
                  <span className="text-xs tabular-nums text-slate-500">{minutesSince(t.createdAt)} min</span>
                  <button type="button" disabled={pending} onClick={() => call(t.id)} className={ghost}><Megaphone className="h-3.5 w-3.5" aria-hidden /> Chamar</button>
                  <button type="button" disabled={pending} onClick={() => act(() => setTicketStatus(t.id, "CANCELLED"))} className={`${ghost} text-slate-500`}>Cancelar</button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function Code({ t }: { t: QueueTicketView }) {
  const p = t.type === "P";
  return (
    <span
      className={`inline-flex h-7 min-w-16 items-center justify-center gap-1 rounded-full px-2.5 font-mono text-sm font-bold ${p ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
      title={p ? "Preferencial" : "Normal"}
    >
      <Ticket className="h-3.5 w-3.5" aria-hidden />
      {t.code}
      {t.serviceName && <span className="font-sans text-[11px] font-medium opacity-70">{t.serviceName}</span>}
    </span>
  );
}
