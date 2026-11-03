"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Loader2, Megaphone, RotateCcw, Ticket } from "lucide-react";
import { toast } from "sonner";
import { callTicket, getQueue, setTicketStatus } from "@/actions/queue-ticket";
import type { QueueTicketView } from "@/lib/queue-ticket-server";
import { toTitleCase } from "@/lib/agenda-ui";

const POLL_MS = 10_000;
const ROOM_KEY = "senhas.room";
const input = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
const ghost = "inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800";

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

  useEffect(() => {
    try {
      const saved = localStorage.getItem(ROOM_KEY);
      if (saved) setRoom(saved);
    } catch {}
  }, []);
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
      const res = await callTicket({ ticketId, room });
      if (!res) toast.info("Ninguém esperando.");
      else toast.success(`${res.code} chamada na TV`);
    });

  const waiting = waitOrder(list);
  const called = list.filter((t) => t.status === "CALLED").sort((a, b) => (b.calledAt ?? "").localeCompare(a.calledAt ?? ""));
  const done = list.filter((t) => t.status === "DONE").length;
  const pCount = waiting.filter((t) => t.type === "P").length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-slate-600 dark:text-slate-400">
            Guichê / sala
            <input value={room} onChange={(e) => saveRoom(e.target.value)} placeholder="ex.: Guichê 1" maxLength={40} className={`${input} w-44`} />
          </label>
          <button
            type="button"
            disabled={pending || waiting.length === 0}
            onClick={() => call()}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-emerald-700 px-5 text-base font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-300 dark:disabled:bg-slate-700"
          >
            {pending ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Megaphone className="h-5 w-5" aria-hidden />}
            Chamar próxima{waiting[0] ? ` (${waiting[0].code})` : ""}
          </button>
          <p className="text-sm text-slate-600 dark:text-slate-400" aria-live="polite">
            <strong className="text-slate-900 dark:text-slate-100">{waiting.length}</strong> esperando
            {pCount > 0 && <> · {pCount} preferencial</>}
            {!compact && <> · {done} atendidas hoje</>}
          </p>
        </div>
      </section>

      {called.length > 0 && (
        <section aria-labelledby="q-called">
          <h2 id="q-called" className="mb-2 text-sm font-semibold">Chamadas</h2>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
            {called.slice(0, compact ? 3 : 20).map((t) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
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
          <h2 id="q-waiting" className="mb-2 text-sm font-semibold">Esperando (ordem de chamada)</h2>
          {waiting.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-500 dark:border-slate-700">
              Ninguém na fila. As senhas aparecem aqui quando o paciente tira no totem.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white dark:divide-slate-800 dark:border-slate-800 dark:bg-slate-900">
              {waiting.map((t) => (
                <li key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
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
      className={`inline-flex h-7 min-w-16 items-center justify-center gap-1 rounded-md px-2 font-mono text-sm font-bold ${p ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200" : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"}`}
      title={p ? "Preferencial" : "Normal"}
    >
      <Ticket className="h-3.5 w-3.5" aria-hidden />
      {t.code}
    </span>
  );
}
