"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteClinicRoom, saveClinicRoom, setDoctorRoomForOccupancy, type RoomView } from "@/actions/occupancy";
import type { RoomHours, RoomKind } from "@/lib/room-occupancy";

const WEEK = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const input =
  "h-9 rounded-lg border border-slate-300 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

type Draft = { id?: string; name: string; kind: RoomKind; days: number[]; start: string; end: string; keywords: string; slotMinutes: number };

const blank = (kind: RoomKind = "CONSULTORIO"): Draft => ({ name: "", kind, days: [1, 2, 3, 4, 5], start: "08:00", end: "18:00", keywords: "", slotMinutes: 10 });

/** Horário simples: mesma faixa nos dias marcados (a clínica não tem grade no sistema). */
function toDraft(r: RoomView): Draft {
  const first = r.hours[0];
  return {
    id: r.id,
    name: r.name,
    kind: r.kind,
    days: [...new Set(r.hours.map((h) => h.weekday))].sort(),
    start: first?.start ?? "08:00",
    end: first?.end ?? "18:00",
    keywords: r.procedureKeywords.join(", "),
    slotMinutes: r.slotMinutes,
  };
}

export function hoursLabel(hours: RoomHours[]): string {
  if (hours.length === 0) return "sem horário";
  const days = [...new Set(hours.map((h) => h.weekday))].sort().map((d) => WEEK[d]);
  const ranges = [...new Set(hours.map((h) => `${h.start}–${h.end}`))];
  return `${days.join(", ")} · ${ranges.join(" / ")}`;
}

export function RoomsEditor({ rooms, allDoctors, doctorRooms }: { rooms: RoomView[]; allDoctors: string[]; doctorRooms: { doctor: string; room: string }[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [pending, start] = useTransition();
  const consultorios = rooms.filter((r) => r.kind === "CONSULTORIO");
  const roomOf = (doctor: string) => doctorRooms.find((d) => d.doctor.trim().toLowerCase() === doctor.trim().toLowerCase())?.room ?? "";

  const run = (fn: () => Promise<unknown>, ok: string) =>
    start(async () => {
      try {
        await fn();
        toast.success(ok);
        setDraft(null);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar.");
      }
    });

  const save = (d: Draft) =>
    run(
      () =>
        saveClinicRoom({
          id: d.id,
          name: d.name,
          kind: d.kind,
          hours: d.days.map((weekday) => ({ weekday, start: d.start, end: d.end })),
          procedureKeywords: d.keywords.split(/[,\n]/),
          slotMinutes: d.slotMinutes,
        }),
      "Sala salva.",
    );

  const quickSetup = () =>
    run(async () => {
      const base = { hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: "08:00", end: "18:00" })), slotMinutes: 10 };
      await saveClinicRoom({ ...base, name: "Consultório 1", kind: "CONSULTORIO", procedureKeywords: [] });
      await saveClinicRoom({ ...base, name: "Consultório 2", kind: "CONSULTORIO", procedureKeywords: [] });
      await saveClinicRoom({ ...base, name: "Sala de exames", kind: "PROCEDIMENTO", procedureKeywords: [] });
    }, "Salas criadas. Ajuste horários, procedimentos e médicos.");

  return (
    <section className="glass-surface p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold">Salas e horários</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            O sistema da clínica não tem grade de horário: o funcionamento de cada sala e a duração padrão de cada marcação ficam aqui.
          </p>
        </div>
        <div className="flex gap-2">
          {rooms.length === 0 && (
            <button type="button" disabled={pending} onClick={quickSetup} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Plus className="size-4" aria-hidden />}
              Criar 2 consultórios e 1 sala de exames
            </button>
          )}
          <button type="button" onClick={() => setDraft(blank())} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 px-3 text-sm font-medium hover:bg-white/70 dark:border-slate-700 dark:hover:bg-white/10">
            <Plus className="size-4" aria-hidden /> Nova sala
          </button>
        </div>
      </div>

      {rooms.length > 0 && (
        <ul className="divide-y divide-slate-200/70 dark:divide-slate-800">
          {rooms.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div className="min-w-0">
                <p className="font-medium">
                  {r.name} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">· {r.kind === "PROCEDIMENTO" ? "sala de exames/procedimentos" : "consultório"} · {r.slotMinutes} min por marcação</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {hoursLabel(r.hours)}
                  {r.kind === "PROCEDIMENTO"
                    ? r.procedureKeywords.length
                      ? ` · procedimentos: ${r.procedureKeywords.join(", ")}`
                      : " · nenhum procedimento ligado ainda"
                    : r.doctors.length
                      ? ` · ${r.doctors.join(", ")}`
                      : " · nenhum médico ligado ainda"}
                </p>
              </div>
              <div className="flex gap-1">
                <button type="button" aria-label={`Editar ${r.name}`} onClick={() => setDraft(toDraft(r))} className="rounded-lg p-2 hover:bg-white/70 dark:hover:bg-white/10">
                  <Pencil className="size-4" aria-hidden />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${r.name}`}
                  onClick={() => confirm(`Excluir ${r.name}?`) && run(() => deleteClinicRoom(r.id), "Sala excluída.")}
                  className="rounded-lg p-2 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/40"
                >
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save(draft);
          }}
          className="space-y-3 rounded-xl border border-slate-200 p-4 dark:border-slate-800"
        >
          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Nome
              <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={`mt-1 block w-48 ${input}`} required />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Tipo
              <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as RoomKind })} className={`mt-1 block ${input}`}>
                <option value="CONSULTORIO">Consultório</option>
                <option value="PROCEDIMENTO">Sala de exames/procedimentos</option>
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Minutos por marcação
              <input type="number" min={5} max={240} value={draft.slotMinutes} onChange={(e) => setDraft({ ...draft, slotMinutes: Number(e.target.value) })} className={`mt-1 block w-24 ${input}`} />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Abre
              <input type="time" value={draft.start} onChange={(e) => setDraft({ ...draft, start: e.target.value })} className={`mt-1 block ${input}`} />
            </label>
            <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Fecha
              <input type="time" value={draft.end} onChange={(e) => setDraft({ ...draft, end: e.target.value })} className={`mt-1 block ${input}`} />
            </label>
          </div>
          <fieldset className="flex flex-wrap gap-2">
            <legend className="mb-1 text-xs font-medium text-slate-600 dark:text-slate-400">Dias de funcionamento</legend>
            {WEEK.map((d, i) => (
              <label key={d} className="inline-flex items-center gap-1 text-sm">
                <input
                  type="checkbox"
                  checked={draft.days.includes(i)}
                  onChange={(e) => setDraft({ ...draft, days: e.target.checked ? [...draft.days, i].sort() : draft.days.filter((x) => x !== i) })}
                />
                {d}
              </label>
            ))}
          </fieldset>
          {draft.kind === "PROCEDIMENTO" && (
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
              Procedimentos feitos nesta sala (palavras do nome do procedimento, separadas por vírgula)
              <input value={draft.keywords} onChange={(e) => setDraft({ ...draft, keywords: e.target.value })} placeholder="Ex.: cistoscopia, ultrassom, biópsia, urodinâmica" className={`mt-1 block w-full ${input}`} />
            </label>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">
              {pending && <Loader2 className="size-4 animate-spin" aria-hidden />} Salvar
            </button>
            <button type="button" onClick={() => setDraft(null)} className="h-9 rounded-lg px-4 text-sm hover:bg-white/70 dark:hover:bg-white/10">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {consultorios.length > 0 && allDoctors.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Consultório de cada médico</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Consultas vão para o consultório do médico; os procedimentos acima vão para a sala de exames. É a mesma sala fixa usada no painel da TV.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {allDoctors.map((doc) => (
              <label key={doc} className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate">{doc}</span>
                <select
                  value={consultorios.some((c) => c.name === roomOf(doc)) ? roomOf(doc) : ""}
                  disabled={pending}
                  onChange={(e) => run(() => setDoctorRoomForOccupancy(doc, e.target.value), "Consultório do médico salvo.")}
                  className={input}
                  aria-label={`Consultório de ${doc}`}
                >
                  <option value="">Sem consultório</option>
                  {consultorios.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
