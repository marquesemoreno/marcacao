"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, CalendarX2, RefreshCw } from "lucide-react";
import { getAgenda, setAgendaStatus, type AgendaResult } from "@/actions/agenda";
import {
  getClinicDoctorAgenda,
  listClinicConveniosForAppointment,
  listClinicDoctorsForAppointment,
  listClinicPatientsForAppointment,
  listClinicProceduresForAppointment,
} from "@/actions/inbox";
import {
  NO_DOCTOR,
  addDays,
  agendaDoctors,
  daySummary,
  monthGridDays,
  weekDays,
  type AgendaItem,
  type AgendaStatusChoice,
} from "@/lib/agenda";
import { AGENDA_STATUS_GROUPS, AGENDA_STATUS_META, formatLongDate, toTitleCase, todayInBahia } from "@/lib/agenda-ui";
import { ScheduleModal } from "@/components/chat/schedule-modal";
import { AgendaSidebar } from "./agenda-sidebar";
import { AGENDA_VIEWS, AgendaToolbar, type AgendaView } from "./agenda-toolbar";
import { AgendaGrid, type AgendaColumn } from "./agenda-grid";
import { AgendaMonth } from "./agenda-month";
import { AgendaSummary } from "./agenda-summary";
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

function brDate(iso: string): string {
  return iso.split("-").reverse().join("/");
}

function nowInBahia(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(11, 16);
}

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900";

/** Agenda da recepção (/clinic/agenda). Data e visão ficam no endereço (F5 e link
 * compartilhável). Pensada pro pico da manhã: resumo do dia no topo (também filtra),
 * grade só do primeiro ao último paciente, linha "agora", troca de status com desfazer. */
export function AgendaApp({ initialDate, initialView }: { initialDate: string; initialView: AgendaView }) {
  const router = useRouter();
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<AgendaView>(initialView);
  const [data, setData] = useState<AgendaResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [openItem, setOpenItem] = useState<AgendaItem | null>(null);
  const [schedule, setSchedule] = useState<{ date: string; time?: string; doctor?: string } | null>(null);
  const [nowTime, setNowTime] = useState(nowInBahia);
  const today = todayInBahia();

  const range = useMemo(() => rangeFor(view, date), [view, date]);

  useEffect(() => {
    router.replace(`/clinic/agenda?data=${date}&visao=${view}`, { scroll: false });
  }, [date, view, router]);

  useEffect(() => {
    const t = setInterval(() => setNowTime(nowInBahia()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Período novo = tela nova: some a agenda anterior (não mostrar o dia errado
  // esmaecido sob o título do dia certo). Recarregar o mesmo período mantém a tela.
  const rangeKey = `${range.from}|${range.to}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    getAgenda(range.from, range.to)
      .then((r) => {
        if (cancelled) return;
        setData(r);
        setLoadedKey(rangeKey);
      })
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, rangeKey, reloadKey]);
  const current = loadedKey === rangeKey ? data : null;

  const allItems = useMemo(() => current?.items ?? [], [current]);
  const doctors = useMemo(() => agendaDoctors(allItems), [allItems]);
  const doctorItems = useMemo(
    () => allItems.filter((i) => selectedDoctors.length === 0 || selectedDoctors.includes(i.doctor?.trim() || NO_DOCTOR)),
    [allItems, selectedDoctors]
  );
  const visibleItems = useMemo(() => {
    if (!selectedGroups.length) return doctorItems;
    const statuses = AGENDA_STATUS_GROUPS.filter((g) => selectedGroups.includes(g.id)).flatMap((g) => g.statuses);
    return doctorItems.filter((i) => statuses.includes(i.status));
  }, [doctorItems, selectedGroups]);
  const summary = useMemo(() => daySummary(doctorItems), [doctorItems]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);

  const applyStatus = useCallback(
    async (item: AgendaItem, status: AgendaStatusChoice) => {
      await setAgendaStatus({ source: item.source, externalId: item.externalId, date: item.date, status });
      if (status === "AUTO") {
        reload(); // o automático depende do lembrete — recalcula no servidor
        setOpenItem(null);
        return;
      }
      setData((d) => (d ? { ...d, items: d.items.map((i) => (i.key === item.key ? { ...i, status, isManual: true } : i)) } : d));
      setOpenItem((o) => (o && o.key === item.key ? { ...o, status, isManual: true } : o));
    },
    [reload]
  );

  const handleSetStatus = useCallback(
    async (item: AgendaItem, status: AgendaStatusChoice) => {
      const previous: AgendaStatusChoice = item.isManual && item.status !== "PENDING" && item.status !== "SENT" && item.status !== "RESCHEDULE"
        ? (item.status as AgendaStatusChoice)
        : "AUTO";
      try {
        await applyStatus(item, status);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não foi possível salvar o status. Tente de novo.");
        throw e;
      }
      const name = toTitleCase(item.patientName || "Paciente");
      toast.success(status === "AUTO" ? `${name}: voltou ao status automático` : `${name} marcado como ${AGENDA_STATUS_META[status].label}`, {
        action: {
          label: "Desfazer",
          onClick: () => {
            applyStatus({ ...item, status: status === "AUTO" ? item.status : status, isManual: status !== "AUTO" }, previous).catch(() =>
              toast.error("Não foi possível desfazer.")
            );
          },
        },
      });
    },
    [applyStatus]
  );

  const move = useCallback(
    (dir: 1 | -1) => {
      if (view === "semana") setDate((d) => addDays(d, 7 * dir));
      else if (view === "mes") {
        setDate((cur) => {
          const d = new Date(`${cur.slice(0, 7)}-01T12:00:00Z`);
          d.setUTCMonth(d.getUTCMonth() + dir);
          return d.toISOString().slice(0, 10);
        });
      } else {
        setDate((cur) => {
          let next = addDays(cur, dir);
          if (new Date(`${next}T12:00:00Z`).getUTCDay() === 0) next = addDays(next, dir); // pula domingo
          return next;
        });
      }
    },
    [view]
  );

  // Atalhos: ← → período, H hoje, D/S/M/P visão. Ignora quando está digitando ou com
  // modal/painel aberto.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey || schedule || openItem) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      if (e.key === "ArrowLeft") move(-1);
      else if (e.key === "ArrowRight") move(1);
      else if (e.key.toLowerCase() === "h") setDate(today);
      else {
        const v = AGENDA_VIEWS.find((x) => x.key.toLowerCase() === e.key.toLowerCase());
        if (!v) return;
        setView(v.id);
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [move, today, schedule, openItem]);

  const label =
    view === "semana"
      ? `Semana de ${brDate(range.days[0])} a ${brDate(range.days[range.days.length - 1])}`
      : view === "mes"
        ? new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
        : formatLongDate(date);

  const columns: AgendaColumn[] = useMemo(() => {
    if (view === "semana") {
      return range.days.map((d) => ({
        id: d,
        label: shortDay(d),
        date: d,
        doctor: selectedDoctors.length === 1 && selectedDoctors[0] !== NO_DOCTOR ? selectedDoctors[0] : null,
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

  const failed = current?.bridgeFailedDays ?? [];
  const includesToday = range.days.includes(today) && view !== "mes";
  const emptyPeriod = !!current && allItems.length === 0 && failed.length === 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
      <AgendaSidebar
        date={date}
        onDateChange={setDate}
        doctors={doctors}
        selectedDoctors={selectedDoctors}
        onToggleDoctor={(d) => setSelectedDoctors((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
        onAllDoctors={() => setSelectedDoctors([])}
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
          onRefresh={reload}
        />

        {current && view !== "mes" && (
          <AgendaSummary
            summary={summary}
            activeGroups={selectedGroups}
            onToggle={(id) => setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          />
        )}

        {failed.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              Não foi possível ler a agenda do sistema da clínica
              {failed.length === 1 ? ` de ${brDate(failed[0])}` : ` em ${failed.length} dias`}. O computador da clínica pode estar desligado — aparecem só
              os agendamentos feitos pelo Conecta.{" "}
              <button type="button" onClick={reload} className="font-semibold underline underline-offset-2">
                Tentar de novo
              </button>
            </span>
          </p>
        )}

        {loadError && !current ? (
          <div className={`${panel} p-10 text-center`} role="alert">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Não foi possível carregar a agenda.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Verifique a internet e tente de novo.</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              <RefreshCw className="w-4 h-4" aria-hidden /> Tentar de novo
            </button>
          </div>
        ) : !current ? (
          <AgendaSkeleton />
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
        ) : (
          <>
            {emptyPeriod && (
              <div className={`${panel} flex items-center gap-3 px-4 py-3`}>
                <CalendarX2 className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Nenhum paciente {view === "semana" ? "nesta semana" : `em ${brDate(date)}`}. Clique num horário ou em “Novo agendamento” para marcar.
                </p>
              </div>
            )}
            {current.hasBridge && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Vem do sistema da clínica — marcações sem telefone cadastrado não aparecem aqui.
              </p>
            )}
            {columns.length === 0 ? (
              <div className={`${panel} p-8 text-center text-sm text-slate-500 dark:text-slate-400`}>Nenhum paciente com esses filtros.</div>
            ) : (
              <AgendaGrid
                columns={columns}
                compact={view === "semana"}
                nowTime={includesToday ? nowTime : null}
                onSlotClick={(col, time) => setSchedule({ date: col.date, time, doctor: col.doctor ?? undefined })}
                onOpen={setOpenItem}
                onSetStatus={handleSetStatus}
              />
            )}
          </>
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
            reload();
          }}
        />
      )}
    </div>
  );
}

function AgendaSkeleton() {
  return (
    <div className={`${panel} p-3 space-y-2`} aria-busy="true" aria-label="Carregando agenda">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex gap-3">
          <div className="h-10 w-10 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" />
          <div className="h-10 flex-1 rounded-md bg-slate-100 dark:bg-slate-800 animate-pulse" style={{ opacity: 1 - i * 0.09 }} />
        </div>
      ))}
    </div>
  );
}
