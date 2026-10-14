"use client";

import { useState } from "react";
import { ChevronDown, Plus, SlidersHorizontal } from "lucide-react";
import { ptBR } from "react-day-picker/locale";
import { Calendar } from "@/components/ui/calendar";
import { toTitleCase } from "@/lib/agenda-ui";

function toIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Painel esquerdo da Agenda: novo agendamento, calendário e filtro de médico. O filtro
 * de status mora na faixa de resumo acima da grade (é também a legenda). Abaixo de 1024px
 * o calendário e o filtro recolhem num botão, pra grade aparecer logo. */
export function AgendaSidebar({
  date,
  onDateChange,
  doctors,
  selectedDoctors,
  onToggleDoctor,
  onAllDoctors,
  onNewAppointment,
}: {
  date: string;
  onDateChange: (iso: string) => void;
  doctors: string[];
  selectedDoctors: string[]; // vazio = todos
  onToggleDoctor: (doctor: string) => void;
  onAllDoctors: () => void;
  onNewAppointment: () => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const selected = new Date(`${date}T12:00:00`);
  const allDoctors = selectedDoctors.length === 0;
  const filterCount = selectedDoctors.length;

  return (
    <aside className="w-full lg:w-[280px] shrink-0 space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onNewAppointment}
          className="flex-1 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 px-4 text-sm font-semibold text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
        >
          <Plus className="w-4 h-4" aria-hidden /> Novo agendamento
        </button>
        <button
          type="button"
          onClick={() => setMobileOpen((o) => !o)}
          aria-expanded={mobileOpen}
          aria-controls="agenda-filters"
          className="lg:hidden inline-flex h-10 items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          <SlidersHorizontal className="w-4 h-4" aria-hidden />
          Data e médico{filterCount ? ` (${filterCount})` : ""}
          <ChevronDown className={`w-4 h-4 transition-transform ${mobileOpen ? "rotate-180" : ""}`} aria-hidden />
        </button>
      </div>

      <div id="agenda-filters" className={`${mobileOpen ? "block" : "hidden"} lg:block space-y-3`}>
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 flex justify-center">
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selected}
            month={selected}
            disabled={{ dayOfWeek: [0] }}
            onMonthChange={(m) => {
              // Mantém o mesmo dia do mês ao trocar de mês (limitado ao último dia).
              const day = Math.min(selected.getDate(), new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate());
              onDateChange(toIso(new Date(m.getFullYear(), m.getMonth(), day)));
            }}
            onSelect={(d) => d && onDateChange(toIso(d))}
          />
        </div>

        <section className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-2">Médico</h2>
          {doctors.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum médico com pacientes neste período.</p>
          ) : (
            <ul className="space-y-0.5 max-h-64 overflow-y-auto">
              <li>
                <label className="flex h-8 items-center gap-2 rounded-md px-1 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input type="checkbox" checked={allDoctors} onChange={onAllDoctors} className="size-4 accent-emerald-600" />
                  Todos
                </label>
              </li>
              {doctors.map((d) => (
                <li key={d}>
                  <label className="flex h-8 items-center gap-2 rounded-md px-1 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800">
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

        <p className="px-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Atalhos: ← → muda o período · H hoje · D S M P troca a visão.
        </p>
      </div>
    </aside>
  );
}
