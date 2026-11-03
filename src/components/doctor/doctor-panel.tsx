"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Megaphone, RefreshCw, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { getSupabaseClient } from "@/lib/supabase-client";
import { doctorCallPatient, doctorFormResponse, doctorSetStatus, getDoctorRealtimeTopic, getMyPatientsToday } from "@/actions/agenda";
import { AGENDA_STATUS_META, toTitleCase } from "@/lib/agenda-ui";
import { doctorKey } from "@/lib/tv-call";
import type { AgendaItem } from "@/lib/agenda";
import { FormResponseSection } from "@/components/clinic/agenda/form-response-section";

type Data = Awaited<ReturnType<typeof getMyPatientsToday>>;

const ORDER: Record<string, number> = { IN_ROOM: 0, IN_SERVICE: 1, CONFIRMED: 2, SENT: 2, PENDING: 2, RESCHEDULE: 3, COMPLETED: 4, NO_SHOW: 5, CANCELLED: 6 };

/** Lista do médico: quem chegou primeiro em cima, "Chamar" anuncia na TV com a sala fixa
 * (ou a escolhida na hora). Atualiza sozinho quando a recepção/paciente muda algo. */
export function DoctorPanel({ initial, rooms }: { initial: Data; rooms: { doctor: string; room: string }[] }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const fixedRoom = initial.doctorName ? rooms.find((r) => doctorKey(r.doctor) === doctorKey(initial.doctorName!))?.room ?? "" : "";
  const [room, setRoom] = useState(fixedRoom);

  const reload = useCallback(async () => {
    try {
      setData(await getMyPatientsToday());
    } catch {}
  }, []);

  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && void reload(), 60_000);
    const supabase = getSupabaseClient();
    let channel: ReturnType<NonNullable<typeof supabase>["channel"]> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (supabase) {
      void getDoctorRealtimeTopic().then((topic) => {
        if (!topic) return;
        channel = supabase
          .channel(topic)
          .on("broadcast", { event: "changed" }, () => {
            clearTimeout(timer);
            timer = setTimeout(() => void reload(), 800);
          })
          .subscribe();
      });
    }
    return () => {
      clearInterval(t);
      clearTimeout(timer);
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [reload]);

  async function run(item: AgendaItem, fn: () => Promise<unknown>, ok: string) {
    setBusy(item.key);
    try {
      await fn();
      toast.success(ok);
      await reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não deu certo, tente de novo.");
    } finally {
      setBusy(null);
    }
  }

  if (!data.doctorName) {
    return (
      <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
        Seu login ainda não está ligado a um médico da agenda. Peça para o administrador preencher “Nome na agenda” no seu cadastro.
      </p>
    );
  }

  const items = [...data.items].sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || (a.time ?? "99").localeCompare(b.time ?? "99"));
  const waiting = items.filter((i) => i.status === "IN_SERVICE").length;
  const name = (i: AgendaItem) => toTitleCase(i.patientName || "Paciente");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">
          <span className="font-semibold">{toTitleCase(data.doctorName)}</span> · {items.length} pacientes · <span className="font-semibold text-sky-700 dark:text-sky-300">{waiting} aguardando</span>
        </p>
        <label className="ml-auto inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          Sala
          <input
            value={room}
            onChange={(e) => setRoom(e.target.value)}
            placeholder="ex.: Consultório 03"
            maxLength={40}
            className="h-9 w-40 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </label>
        <button type="button" onClick={() => void reload()} className="inline-flex size-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Atualizar">
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {items.length === 0 && <p className="rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Nenhum paciente hoje.</p>}

      <ul className="space-y-2">
        {items.map((item) => {
          const meta = AGENDA_STATUS_META[item.status];
          const loading = busy === item.key;
          const done = item.status === "COMPLETED" || item.status === "NO_SHOW" || item.status === "CANCELLED";
          return (
            <li key={item.key} className={`flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 dark:border-slate-800 dark:bg-slate-900 ${done ? "opacity-60" : ""}`}>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">
                  <span className="mr-2 text-sm tabular-nums text-slate-500">{item.time ?? "—"}</span>
                  {name(item)}
                  {item.formDone && <span className="ml-2 rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">ficha</span>}
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{meta.label}</p>
              </div>
              {(item.status === "IN_SERVICE" || item.status === "CONFIRMED" || item.status === "SENT" || item.status === "PENDING") && (
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void run(item, () => doctorCallPatient({ source: item.source, externalId: item.externalId, room: room || null }), `${name(item)} chamado na TV`)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Stethoscope className="h-4 w-4" aria-hidden />} Chamar
                </button>
              )}
              {item.status === "IN_ROOM" && (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void run(item, () => doctorCallPatient({ source: item.source, externalId: item.externalId, room: room || null }), "Chamado de novo")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-semibold dark:border-slate-700"
                  >
                    <Megaphone className="h-4 w-4" aria-hidden /> Chamar de novo
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void run(item, () => doctorSetStatus({ source: item.source, externalId: item.externalId, status: "COMPLETED" }), "Atendido")}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-emerald-300 px-3 text-sm font-semibold text-emerald-800 dark:border-emerald-700 dark:text-emerald-300"
                  >
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Atendido
                  </button>
                </>
              )}
              {item.formDone && (
                <div className="basis-full">
                  <FormResponseSection item={item} load={doctorFormResponse} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
