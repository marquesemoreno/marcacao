"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { getAgenda, setAgendaStatus, type AgendaResult } from "@/actions/agenda";
import {
  getClinicDoctorAgenda,
  listClinicConveniosForAppointment,
  listClinicDoctorsForAppointment,
  listClinicPatientsForAppointment,
  listClinicProceduresForAppointment,
} from "@/actions/inbox";
import { NO_DOCTOR, addDays, agendaDoctors, monthGridDays, weekDays, type AgendaItem, type ManualAgendaStatus } from "@/lib/agenda";
import { AGENDA_STATUS_GROUPS, formatLongDate, toTitleCase, todayInBahia } from "@/lib/agenda-ui";
import { ScheduleModal } from "@/components/chat/schedule-modal";
import { AgendaSidebar } from "./agenda-sidebar";
import { AgendaToolbar, type AgendaView } from "./agenda-toolbar";
import { AgendaGrid, type AgendaColumn } from "./agenda-grid";
import { AgendaMonth } from "./agenda-month";
import { PatientSheet } from "./patient-sheet";

function rangeFor(view: AgendaView, date: string): { from: string; to: string; days: string[] } {
  if (view === "semana") {
    const days = weekDays(date);
    return { from: days[0], to: days[days.length - 1], days };
  }
  if (view === "mes") {
    const days = monthGridDays(date);
    return { from: days[0], to: days[days.length - 1], days };
  }
  return { from: date, to: date, days: [date] };
}

function shortDay(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/** Agenda da recepção (/clinic/agenda). Data e visão ficam no endereço pra dar F5 e
 * compartilhar o link. */
export function AgendaApp({ initialDate, initialView }: { initialDate: string; initialView: AgendaView }) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<AgendaView>(initialView);
  const [data, setData] = useState<AgendaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [openItem, setOpenItem] = useState<AgendaItem | null>(null);
  const [schedule, setSchedule] = useState<{ date: string; time?: string; doctor?: string } | null>(null);
  const today = todayInBahia();

  const range = useMemo(() => rangeFor(view, date), [view, date]);

  useEffect(() => {
    router.replace(`/clinic/agenda?data=${date}&visao=${view}`, { scroll: false });
  }, [date, view, router]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getAgenda(range.from, range.to)
      .then((r) => !cancelled && setData(r))
      .catch(() => !cancelled && toast.error("Não foi possível carregar a agenda."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, reloadKey]);

  const allItems = useMemo(() => data?.items ?? [], [data]);
  const doctors = useMemo(() => agendaDoctors(allItems), [allItems]);

  const visibleItems = useMemo(() => {
    const groupStatuses = selectedGroups.length
      ? AGENDA_STATUS_GROUPS.filter((g) => selectedGroups.includes(g.id)).flatMap((g) => g.statuses)
      : null;
    return allItems.filter(
      (i) =>
        (selectedDoctors.length === 0 || selectedDoctors.includes(i.doctor?.trim() || NO_DOCTOR)) &&
        (!groupStatuses || groupStatuses.includes(i.status))
    );
  }, [allItems, selectedDoctors, selectedGroups]);

  const handleSetStatus = useCallback(async (item: AgendaItem, status: ManualAgendaStatus) => {
    try {
      await setAgendaStatus({ source: item.source, externalId: item.externalId, date: item.date, status });
      // Atualiza na hora, sem esperar recarregar a ponte.
      setData((d) => (d ? { ...d, items: d.items.map((i) => (i.key === item.key ? { ...i, status } : i)) } : d));
      setOpenItem((o) => (o && o.key === item.key ? { ...o, status } : o));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar o status.");
      throw e;
    }
  }, []);

  function move(dir: 1 | -1) {
    if (view === "semana") setDate(addDays(date, 7 * dir));
    else if (view === "mes") {
      const d = new Date(`${date.slice(0, 7)}-01T12:00:00Z`);
      d.setUTCMonth(d.getUTCMonth() + dir);
      setDate(d.toISOString().slice(0, 10));
    } else {
      let next = addDays(date, dir);
      if (new Date(`${next}T12:00:00Z`).getUTCDay() === 0) next = addDays(next, dir); // pula domingo
      setDate(next);
    }
  }

  const label =
    view === "semana"
      ? `Semana de ${range.days[0].split("-").reverse().slice(0, 2).join("/")} a ${range.days[range.days.length - 1].split("-").reverse().join("/")}`
      : view === "mes"
        ? new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
        : formatLongDate(date);

  // Colunas da grade conforme a visão.
  const columns: AgendaColumn[] = useMemo(() => {
    if (view === "semana") {
      return range.days.map((d) => ({
        id: d,
        label: shortDay(d),
        date: d,
        doctor: selectedDoctors.length === 1 ? selectedDoctors[0] : null,
        items: visibleItems.filter((i) => i.date === d),
        highlight: d === today,
      }));
    }
    if (view === "medico") {
      const names = selectedDoctors.length ? doctors.filter((d) => selectedDoctors.includes(d)) : doctors;
      return names.map((n) => ({
        id: n,
        label: n === NO_DOCTOR ? n : toTitleCase(n),
        date,
        doctor: n === NO_DOCTOR ? null : n,
        items: visibleItems.filter((i) => (i.doctor?.trim() || NO_DOCTOR) === n),
      }));
    }
    return [
      {
        id: date,
        label: selectedDoctors.length === 1 ? toTitleCase(selectedDoctors[0]) : "Todos os médicos",
        date,
        doctor: selectedDoctors.length === 1 && selectedDoctors[0] !== NO_DOCTOR ? selectedDoctors[0] : null,
        items: visibleItems,
      },
    ];
  }, [view, range.days, visibleItems, selectedDoctors, doctors, date, today]);

  const failed = data?.bridgeFailedDays ?? [];

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      <AgendaSidebar
        date={date}
        onDateChange={setDate}
        doctors={doctors}
        selectedDoctors={selectedDoctors}
        onToggleDoctor={(d) =>
          setSelectedDoctors((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))
        }
        onAllDoctors={() => setSelectedDoctors([])}
        selectedGroups={selectedGroups}
        onToggleGroup={(id) =>
          setSelectedGroups((prev) => {
            const base = prev.length ? prev : AGENDA_STATUS_GROUPS.map((g) => g.id);
            const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
            return next.length === AGENDA_STATUS_GROUPS.length ? [] : next;
          })
        }
        onNewAppointment={() => setSchedule({ date: date < today ? today : date })}
      />

      <div className="flex-1 min-w-0 space-y-3">
        <AgendaToolbar
          label={label}
          view={view}
          loading={loading}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
          onToday={() => setDate(today)}
          onView={setView}
          onRefresh={() => setReloadKey((k) => k + 1)}
        />

        {failed.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
            Não foi possível ler a agenda do sistema da clínica
            {failed.length === 1 ? ` de ${failed[0].split("-").reverse().join("/")}` : ` em ${failed.length} dias`}. O computador da clínica
            pode estar desligado — aparecem só os agendamentos feitos pelo Conecta.
          </p>
        )}

        {!loading && data?.hasBridge && (
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Vem do sistema da clínica: só aparecem marcações com telefone cadastrado.
          </p>
        )}

        {loading && !data ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
            Carregando agenda…
          </div>
        ) : view === "mes" ? (
          <AgendaMonth
            days={range.days}
            month={date.slice(0, 7)}
            today={today}
            selected={date}
            items={visibleItems}
            failedDays={failed}
            onPickDay={(d) => {
              setDate(d);
              setView("dia");
            }}
          />
        ) : view === "medico" && columns.length === 0 ? (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center text-sm text-slate-500">
            Nenhum paciente neste dia.
          </div>
        ) : (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            <AgendaGrid
              columns={columns}
              compact={view === "semana"}
              onSlotClick={(col, time) => setSchedule({ date: col.date, time, doctor: col.doctor ?? undefined })}
              onOpen={setOpenItem}
              onSetStatus={handleSetStatus}
            />
          </div>
        )}
      </div>

      <PatientSheet item={openItem} onClose={() => setOpenItem(null)} onSetStatus={handleSetStatus} />

      {schedule && (
        <ScheduleModal
          contact={{ name: "", cpf: "", phone: "" }}
          isOpen={!!schedule}
          onClose={() => setSchedule(null)}
          initialDate={schedule.date}
          initialTime={schedule.time}
          initialDoctorName={schedule.doctor}
          fetchProcedures={listClinicProceduresForAppointment}
          fetchDoctors={listClinicDoctorsForAppointment}
          fetchConvenios={listClinicConveniosForAppointment}
          fetchAgenda={getClinicDoctorAgenda}
          fetchPatients={listClinicPatientsForAppointment}
          onConfirmSchedule={() => {
            toast.success("Agendamento criado.");
            setReloadKey((k) => k + 1);
          }}
        />
      )}
    </div>
  );
}
