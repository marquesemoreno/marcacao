"use client";

import { Plus } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { AGENDA_STATUS_GROUPS } from "@/lib/agenda-ui";
import { toTitleCase } from "@/lib/agenda-ui";

/** Painel esquerdo da Agenda: calendário, filtros de médico e status, legenda e o botão
 * de novo agendamento. */
export function AgendaSidebar({
  date,
  onDateChange,
  doctors,
  selectedDoctors,
  onToggleDoctor,
  onAllDoctors,
  selectedGroups,
  onToggleGroup,
  onNewAppointment,
}: {
  date: string;
  onDateChange: (iso: string) => void;
  doctors: string[];
  selectedDoctors: string[]; // vazio = todos
  onToggleDoctor: (doctor: string) => void;
  onAllDoctors: () => void;
  selectedGroups: string[]; // vazio = todos
  onToggleGroup: (id: string) => void;
  onNewAppointment: () => void;
}) {
  const selected = new Date(`${date}T12:00:00`);
  const allDoctors = selectedDoctors.length === 0;

  return (
    <aside className="w-full lg:w-[280px] shrink-0 space-y-4">
      <button
        type="button"
        onClick={onNewAppointment}
        className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white"
      >
        <Plus className="w-4 h-4" aria-hidden /> Novo Agendamento
      </button>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex justify-center">
        <Calendar
          mode="single"
          locale={ptBR}
          selected={selected}
          month={selected}
          onMonthChange={(m) => {
            const iso = `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-01`;
            onDateChange(iso);
          }}
          onSelect={(d) => {
            if (!d) return;
            onDateChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
          }}
        />
      </div>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Médico</h2>
        {doctors.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum médico com pacientes neste período.</p>
        ) : (
          <ul className="space-y-1.5 max-h-56 overflow-y-auto">
            <li>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input type="checkbox" checked={allDoctors} onChange={onAllDoctors} className="size-4 accent-emerald-600" />
                Todos
              </label>
            </li>
            {doctors.map((d) => (
              <li key={d}>
                <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={!allDoctors && selectedDoctors.includes(d)}
                    onChange={() => onToggleDoctor(d)}
                    className="size-4 accent-emerald-600"
                  />
                  <span className="truncate">{toTitleCase(d)}</span>
                </label>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Status</h2>
        <ul className="space-y-1.5">
          {AGENDA_STATUS_GROUPS.map((g) => (
            <li key={g.id}>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={selectedGroups.length === 0 || selectedGroups.includes(g.id)}
                  onChange={() => onToggleGroup(g.id)}
                  className="size-4 accent-emerald-600"
                />
                <span className={`size-2.5 rounded-full ${g.dot}`} aria-hidden />
                {g.label}
              </label>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          A confirmação vem da resposta ao lembrete do WhatsApp; presente, atendido e falta a recepção marca no card.
        </p>
      </section>
    </aside>
  );
}
