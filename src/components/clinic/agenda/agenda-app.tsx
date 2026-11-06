"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAgendaRealtime } from "@/hooks/use-agenda-realtime";
import { AlertTriangle, CalendarX2, Keyboard, RefreshCw, Search, X } from "lucide-react";
import { getAgenda, setAgendaStatus, type AgendaResult } from "@/actions/agenda";
import { getSlotCandidates, listWaitlist } from "@/actions/waitlist";
import { openSlotFromStatus, type OpenSlot } from "@/lib/waitlist";
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
  matchesPatientQuery,
  overdueMinutes,
  systemPendings,
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
import { ArrivalQueue } from "./arrival-queue";
import { SystemPendings } from "./system-pendings";
import { BookingRequests } from "./booking-requests";
import { PatientSheet } from "./patient-sheet";
import { WaitlistDialog } from "./waitlist-dialog";
import { QueuePanel } from "@/components/clinic/queue-panel";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { WeekLoadTable } from "./week-load";
import { isNationalHolidayYMD } from "@/lib/holidays";

const isHoliday = (iso: string) => isNationalHolidayYMD(+iso.slice(0, 4), +iso.slice(5, 7), +iso.slice(8, 10));

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

const SHORTCUTS: [string, string][] = [
  ["← →", "Período anterior / próximo"],
  ["H", "Hoje"],
  ["D S M P", "Dia, Semana, Mês, Por médico"],
  ["/", "Buscar paciente"],
  ["Esc", "Limpar a busca / fechar"],
  ["?", "Mostrar estes atalhos"],
];

const panel = "rounded-2xl bg-white dark:bg-slate-900 shadow-xs";

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
  const [query, setQuery] = useState("");
  const [lateOnly, setLateOnly] = useState(false);
  // Pendências e busca não podem depender do período aberto (crítica 02/11, 4ª): janela fixa
  // de 7 dias atrás a ~5 semanas à frente, recarregada junto com a agenda.
  const [wide, setWide] = useState<AgendaItem[]>([]);
  // Crítica 02/11 (5ª): 42 dias a cada 90 s pesava no PC da clínica — janela larga só a cada 10 min.
  const [wideKey, setWideKey] = useState(0);
  useEffect(() => {
    const t = setInterval(() => document.visibilityState === "visible" && setWideKey((k) => k + 1), 10 * 60_000);
    return () => clearInterval(t);
  }, []);
  const [helpOpen, setHelpOpen] = useState(false);
  // Semana: tabela de carga (médico × dia) ou grade com os pacientes. Lembra por aparelho.
  const [weekMode, setWeekModeState] = useState<"carga" | "pacientes">("carga");
  useEffect(() => {
    try {
      if (localStorage.getItem("agenda.weekMode") === "pacientes") setWeekModeState("pacientes");
    } catch {}
  }, []);
  const setWeekMode = (m: "carga" | "pacientes") => {
    setWeekModeState(m);
    try {
      localStorage.setItem("agenda.weekMode", m);
    } catch {}
  };
  const searchRef = useRef<HTMLInputElement>(null);
  const helpTriggerRef = useRef<HTMLButtonElement>(null);
  const closeHelp = useCallback(() => {
    setHelpOpen(false);
    requestAnimationFrame(() => helpTriggerRef.current?.focus());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [openItem, setOpenItem] = useState<AgendaItem | null>(null);
  const [schedule, setSchedule] = useState<{
    date: string;
    time?: string;
    doctor?: string;
    /** Remarcação: já abre com o paciente da marcação original. */
    patient?: { name: string; phone: string; from: AgendaItem };
  } | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [senhasOpen, setSenhasOpen] = useState(false);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [waitlistSlot, setWaitlistSlot] = useState<{ slot: OpenSlot; exceptPhone: string | null } | null>(null);
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  useEffect(() => {
    listWaitlist()
      .then((list) => setWaitlistCount(list.filter((e) => e.status === "WAITING").length))
      .catch(() => setWaitlistCount(null));
  }, []);
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
        setUpdatedAt(nowInBahia());
      })
      .catch(() => !cancelled && setLoadError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, rangeKey, reloadKey]);
  const loadedCurrent = loadedKey === rangeKey ? data : null;
  const [wideLoaded, setWideLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const t = todayInBahia();
    getAgenda(addDays(t, -7), addDays(t, 34))
      .then((r) => {
        if (cancelled) return;
        setWide(r.items);
        setWideLoaded(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [wideKey]);

  // Crítica 02/11 (9ª): trocar data/visão apagava tudo por 3–5 s. Se o período cabe na
  // janela larga (hoje-7..+34), mostra já esses dados (dia certo, talvez um pouco velhos)
  // enquanto a ponte responde; esqueleto só fora dela.
  const provisional = useMemo<AgendaResult | null>(() => {
    if (loadedCurrent || !wideLoaded) return null;
    const t = todayInBahia();
    if (range.from < addDays(t, -7) || range.to > addDays(t, 34)) return null;
    return { items: wide.filter((i) => i.date >= range.from && i.date <= range.to), hasBridge: true, bridgeFailedDays: [] };
  }, [loadedCurrent, wideLoaded, wide, range.from, range.to]);
  const current = loadedCurrent ?? provisional;

  const allItems = useMemo(() => current?.items ?? [], [current]);
  const doctors = useMemo(() => agendaDoctors(allItems), [allItems]);
  const doctorItems = useMemo(
    () => allItems.filter((i) => selectedDoctors.length === 0 || selectedDoctors.includes(i.doctor?.trim() || NO_DOCTOR)),
    [allItems, selectedDoctors]
  );
  const visibleItems = useMemo(() => {
    let byQuery = doctorItems.filter((i) => matchesPatientQuery(i, query));
    if (lateOnly) byQuery = byQuery.filter((i) => overdueMinutes(i, today, nowTime) !== null);
    if (!selectedGroups.length) return byQuery;
    const statuses = AGENDA_STATUS_GROUPS.filter((g) => selectedGroups.includes(g.id)).flatMap((g) => g.statuses);
    return byQuery.filter((i) => statuses.includes(i.status));
  }, [doctorItems, selectedGroups, query, lateOnly, today, nowTime]);
  // "atrasados" só existe hoje — não deixar o filtro ligado ao trocar de dia (grade vazia
  // parecia "ninguém marcado").
  useEffect(() => {
    if (!range.days.includes(today)) setLateOnly(false);
  }, [range.days, today]);
  const filtersOn = selectedGroups.length > 0 || lateOnly || query.trim() !== "" || selectedDoctors.length > 0;
  const clearFilters = () => {
    setSelectedGroups([]);
    setLateOnly(false);
    setQuery("");
    setSelectedDoctors([]);
  };
  const lateCount = useMemo(() => doctorItems.filter((i) => overdueMinutes(i, today, nowTime) !== null).length, [doctorItems, today, nowTime]);
  // Busca fora do período aberto (telefonema "quando é minha consulta?").
  const otherMatches = useMemo(() => {
    if (query.trim().length < 2) return [];
    const inView = new Set(allItems.map((i) => i.key));
    return wide
      .filter((i) => !inView.has(i.key) && i.date >= today && matchesPatientQuery(i, query))
      .sort((a, b) => (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? "")))
      .slice(0, 8);
  }, [wide, allItems, query, today]);
  const summary = useMemo(() => daySummary(doctorItems), [doctorItems]);

  const reload = useCallback(() => setReloadKey((k) => k + 1), []);
  const [bookingCount, setBookingCount] = useState(0);
  // Ao vivo: outra tela ou o "Cheguei" do paciente avisa e recarrega (sem esperar 90 s).
  const live = useAgendaRealtime(() => {
    if (!document.querySelector("[data-status-menu]")) reload();
  });

  // Respostas ao lembrete mudam o status ao longo da manhã: recarrega sozinho a cada 90 s
  // (sem esqueleto — mesmo período), só com a aba visível e nada aberto por cima.
  useEffect(() => {
    const t = setInterval(() => {
      // Também não recarrega com o menu de status de um cartão aberto (2º toque em andamento).
      if (document.visibilityState === "visible" && !schedule && !openItem && !document.querySelector("[data-status-menu]")) reload();
    }, 90_000);
    return () => clearInterval(t);
  }, [reload, schedule, openItem]);

  const applyStatus = useCallback(
    async (item: AgendaItem, status: AgendaStatusChoice, keepArrivedAt?: string) => {
      await setAgendaStatus({ source: item.source, externalId: item.externalId, date: item.date, phone: item.phone, status, arrivedAt: keepArrivedAt });
      if (status === "AUTO") {
        reload(); // o automático depende do lembrete — recalcula no servidor
        setWideKey((k) => k + 1);
        setOpenItem(null);
        return;
      }
      const arrivedAt = status === "IN_SERVICE" ? keepArrivedAt ?? new Date().toISOString() : undefined;
      setData((d) => (d ? { ...d, items: d.items.map((i) => (i.key === item.key ? { ...i, status, isManual: true, arrivedAt } : i)) } : d));
      // Pendências/busca usam a janela larga: atualiza na hora (antes esperava o recarregamento).
      setWide((w) => {
        const has = w.some((i) => i.key === item.key);
        const next = { ...item, status, isManual: true, arrivedAt };
        return has ? w.map((i) => (i.key === item.key ? next : i)) : [...w, next];
      });
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
      // Cancelou/faltou num horário que ainda não passou: avisa se tem alguém na espera que combina.
      const openSlot = openSlotFromStatus(
        { status, date: item.date, time: item.time, doctor: item.doctor, procedure: item.procedure },
        { date: todayInBahia(), time: nowInBahia() }
      );
      if (openSlot) {
        getSlotCandidates(openSlot, item.phone)
          .then((found) => {
            if (found.length === 0) return;
            toast.info(`Vaga aberta às ${openSlot.time}: ${found.length} na lista de espera combina${found.length === 1 ? "" : "m"}`, {
              duration: 15000,
              action: {
                label: "Ver lista",
                onClick: () => {
                  setWaitlistSlot({ slot: openSlot, exceptPhone: item.phone });
                  setWaitlistOpen(true);
                },
              },
            });
          })
          .catch(() => {});
      }
      const removesFromAgenda = item.source === "BRIDGE" && (status === "NO_SHOW" || status === "CANCELLED");
      toast.success(status === "AUTO" ? `${name}: voltou ao status do lembrete` : `${name} marcado como ${AGENDA_STATUS_META[status].label}`, {
        description: removesFromAgenda ? "Marcado só no Conecta — ajuste também no sistema da clínica." : undefined,
        duration: removesFromAgenda ? 8000 : undefined,
        action: {
          label: "Desfazer",
          onClick: () => {
            const undo = () =>
              applyStatus(
                { ...item, status: status === "AUTO" ? item.status : status, isManual: status !== "AUTO" },
                previous,
                previous === "IN_SERVICE" ? item.arrivedAt : undefined
              ).catch(() => toast.error("Não foi possível desfazer.", { action: { label: "Tentar de novo", onClick: () => void undo() } }));
            void undo();
          },
        },
      });
    },
    [applyStatus]
  );

  const handleReschedule = useCallback((item: AgendaItem) => {
    setOpenItem(null);
    setSchedule({
      date: item.date < todayInBahia() ? todayInBahia() : item.date,
      doctor: item.doctor ?? undefined,
      patient: { name: toTitleCase(item.patientName || ""), phone: item.phone ?? "", from: item },
    });
  }, []);

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
      if (e.key === "Escape" && helpOpen) return closeHelp();
      if (e.ctrlKey || e.metaKey || e.altKey || schedule || openItem) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName))) return;
      // Crítica 02/11 (3ª): ← dentro do menu de status trocava o dia por baixo dele.
      if (el?.closest('[data-status-menu], [role="dialog"], [role="menu"], [data-popup-open]')) return;
      if (e.key === "/") searchRef.current?.focus();
      else if (e.key === "?") setHelpOpen((o) => !o);
      else if (e.key === "ArrowLeft") move(-1);
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
  }, [move, today, schedule, openItem, helpOpen]);

  const label =
    view === "semana"
      ? `Semana de ${brDate(range.days[0])} a ${brDate(range.days[range.days.length - 1])}`
      : view === "mes"
        ? new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "UTC" })
        : formatLongDate(date);
  // Celular: "Terça-feira, 3 de nov…" truncava; forma curta "Ter, 03/11" (crítica 8ª).
  const shortLabel =
    view === "dia" || view === "medico"
      ? new Date(`${date}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "UTC" }).replace(".", "").replace(/^./, (c) => c.toUpperCase())
      : undefined;

  const columns: AgendaColumn[] = useMemo(() => {
    if (view === "semana") {
      return range.days.map((d) => ({
        id: d,
        label: shortDay(d),
        date: d,
        doctor: selectedDoctors.length === 1 && selectedDoctors[0] !== NO_DOCTOR ? selectedDoctors[0] : null,
        items: visibleItems.filter((i) => i.date === d),
        highlight: d === today,
        // "0 pacientes" verde num feriado parecia dia livre pra marcar.
        ...(isHoliday(d) ? { sublabel: `Feriado · ${visibleItems.filter((i) => i.date === d).length} pac.` } : {}),
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
  const pendings = useMemo(() => systemPendings(wide.length ? wide : allItems, today), [wide, allItems, today]);
  const includesToday = range.days.includes(today) && view !== "mes";
  const railWaiting = includesToday ? doctorItems.filter((i) => i.date === today && i.status === "IN_SERVICE").length : 0;
  const railInRoom = includesToday ? doctorItems.filter((i) => i.date === today && i.status === "IN_ROOM").length : 0;
  const emptyPeriod = !!current && allItems.length === 0 && failed.length === 0;

  return (
    <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 px-4 lg:px-0">
      <AgendaSidebar
        date={date}
        onDateChange={setDate}
        doctors={[...doctors, ...selectedDoctors.filter((d) => !doctors.includes(d))]}
        selectedDoctors={selectedDoctors}
        onToggleDoctor={(d) => setSelectedDoctors((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]))}
        onAllDoctors={() => setSelectedDoctors([])}
        onNewAppointment={() => setSchedule({ date: date < today ? today : date })}
        loading={!current}
      />

      <div className="flex-1 min-w-0 space-y-3 pb-20 md:pb-0">
        <AgendaToolbar
          label={label}
          shortLabel={shortLabel}
          view={view}
          loading={loading}
          onPrev={() => move(-1)}
          onNext={() => move(1)}
          onToday={() => setDate(today)}
          onView={setView}
          onRefresh={reload}
          live={live}
          onWaitlist={() => {
            setWaitlistSlot(null);
            setWaitlistOpen(true);
          }}
          waitlistCount={waitlistCount}
          onSenhas={() => setSenhasOpen(true)}
        />

        {/* Crítica 02/11: o aviso da ponte ficava abaixo da fila — com a ponte fora, a grade parece completa. */}
        {failed.length > 0 && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-3 py-2.5 text-sm font-medium text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
            <span>
              Não foi possível ler a agenda do sistema da clínica
              {failed.length === 1
                ? ` de ${brDate(failed[0])}`
                : failed.length <= 3
                  ? ` de ${failed.map((d) => brDate(d).slice(0, 5)).join(", ")}`
                  : ` em ${failed.length} dias`}. O computador da clínica pode estar desligado — aparecem só
              os agendamentos feitos pelo Conecta, não diga ao paciente que ele não está marcado.{" "}
              <button type="button" onClick={reload} className="font-semibold underline underline-offset-2">
                Tentar de novo
              </button>
            </span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="relative min-w-[12rem] max-w-sm flex-1">
            <span className="sr-only">Buscar paciente na agenda</span>
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  setQuery("");
                  e.currentTarget.blur();
                }
              }}
              placeholder="Buscar paciente"
              className="h-9 w-full rounded-full border border-transparent bg-slate-100 dark:bg-slate-800 pl-8 pr-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            />
          </label>
          {query && current && (
            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-slate-500 dark:text-slate-400" aria-live="polite">
              {visibleItems.length} {visibleItems.length === 1 ? "encontrado" : "encontrados"} neste período
              <button type="button" onClick={() => setQuery("")} aria-label="Limpar busca" className="rounded p-1 hover:text-slate-800 dark:hover:text-slate-100">
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          )}
          <button
            type="button"
            ref={helpTriggerRef}
            onClick={() => setHelpOpen(true)}
            className="ml-auto hidden md:inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            <Keyboard className="h-4 w-4" aria-hidden /> Atalhos <kbd className="rounded border border-slate-300 dark:border-slate-600 px-1 font-mono text-[11px]">?</kbd>
          </button>
        </div>

        {query.trim() && current && (otherMatches.length > 0 || visibleItems.length === 0) && (
          <div className={`${panel} px-4 py-2.5 text-sm`}>
            {otherMatches.length > 0 ? (
              <>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Também nas próximas semanas:</p>
                <ul className="mt-1 space-y-0.5">
                  {otherMatches.map((i) => (
                    <li key={i.key}>
                      <button
                        type="button"
                        onClick={() => {
                          setDate(i.date);
                          setView("dia");
                        }}
                        className="text-left underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded"
                      >
                        <span className="font-medium">{toTitleCase(i.patientName || "Paciente")}</span>{" "}
                        <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                          {brDate(i.date).slice(0, 5)} {i.time ?? ""} {i.doctor ? `· ${toTitleCase(i.doctor)}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-slate-600 dark:text-slate-300">Ninguém com esse nome ou telefone de hoje até as próximas 5 semanas.</p>
            )}
            {current.hasBridge && (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Marcações sem telefone no sistema da clínica não aparecem no Conecta — se não achou, confira lá.
              </p>
            )}
          </div>
        )}

        {view === "mes" && selectedGroups.length > 0 && (
          <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Contando só: {AGENDA_STATUS_GROUPS.filter((g) => selectedGroups.includes(g.id)).map((g) => g.label.toLowerCase()).join(", ")}.
            <button type="button" onClick={() => setSelectedGroups([])} className="font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
              Limpar filtro
            </button>
          </p>
        )}
        {updatedAt && current && (
          loadError ? (
            <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-300 tabular-nums">
              Sem conexão — mostrando a agenda das {updatedAt}.{" "}
              <button type="button" onClick={reload} className="underline underline-offset-2">
                Tentar de novo
              </button>
            </p>
          ) : (
            <p
              className={`text-xs text-slate-500 dark:text-slate-400 tabular-nums ${live ? "hidden md:block" : ""}`}
              aria-live="off"
              title={current.hasBridge ? "Marcações sem telefone no sistema da clínica não aparecem aqui." : undefined}
            >
              {/* Crítica 02/11 (6ª): com "Ao vivo" ligado, o aviso de 90 s contradizia o ponto verde. */}
              Atualizado às {updatedAt}{live ? "" : " · atualiza sozinho a cada minuto e meio"}
            </p>
          )
        )}

        {/* Abaixo de xl a coluna da fila cai pra baixo da grade: este atalho mostra o que
            espera ação sem rolar (crítica 02/11, 6ª). */}
        {(railWaiting + railInRoom + bookingCount > 0) && (
          <a
            href="#fila-recepcao"
            className="xl:hidden flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 px-3 py-1.5 text-sm text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {railWaiting > 0 && <span className="tabular-nums"><strong>{railWaiting}</strong> aguardando</span>}
            {railInRoom > 0 && <span className="tabular-nums"><strong>{railInRoom}</strong> em atendimento</span>}
            {bookingCount > 0 && <span className="tabular-nums"><strong>{bookingCount}</strong> {bookingCount === 1 ? "pedido de marcação" : "pedidos de marcação"}</span>}
            <span className="ml-auto text-xs font-medium underline underline-offset-2">Ver fila</span>
          </a>
        )}

        {current && view !== "mes" && (
          <AgendaSummary
            lateCount={includesToday ? lateCount : 0}
            lateActive={lateOnly}
            onToggleLate={() => setLateOnly((v) => !v)}
            summary={summary}
            activeGroups={selectedGroups}
            onToggle={(id) => setSelectedGroups((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))}
          />
        )}

        {current && filtersOn && view !== "mes" && visibleItems.length < allItems.length && (
          <p role="status" className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 dark:bg-slate-900 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
            <span className="tabular-nums">
              Mostrando {visibleItems.length} de {allItems.length} {allItems.length === 1 ? "paciente" : "pacientes"} — filtro ativo
              {[
                selectedDoctors.length ? `médico: ${selectedDoctors.map((d) => (d === NO_DOCTOR ? d : toTitleCase(d))).join(", ")}` : "",
                lateOnly ? "só atrasados" : "",
                selectedGroups.length ? AGENDA_STATUS_GROUPS.filter((g) => selectedGroups.includes(g.id)).map((g) => g.label.toLowerCase()).join(", ") : "",
                query.trim() ? `busca “${query.trim()}”` : "",
              ]
                .filter(Boolean)
                .map((t) => ` · ${t}`)
                .join("")}
            </span>
            <button type="button" onClick={clearFilters} className="font-semibold text-emerald-700 dark:text-emerald-400 underline underline-offset-2">
              Limpar filtros
            </button>
          </p>
        )}

        {loadError && !current ? (
          <div className={`${panel} p-10 text-center`} role="alert">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Não foi possível carregar a agenda.</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Pode ser a internet ou uma instabilidade no Conecta. Tente de novo em instantes.</p>
            <button
              type="button"
              onClick={reload}
              className="mt-4 inline-flex h-9 items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-800 px-4 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700"
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
          // Crítica 02/11 (3ª): fila e pendências cresciam acima da grade e empurravam os
          // cartões no meio do toque. Agora ficam numa coluna ao lado (abaixo em tela estreita).
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start">
          <div className="min-w-0 flex-1 space-y-3">
            {emptyPeriod && (
              <div className={`${panel} flex items-center gap-3 px-4 py-3`}>
                <CalendarX2 className="w-5 h-5 shrink-0 text-slate-400" aria-hidden />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {view !== "semana" && isHoliday(date) ? "Feriado nacional. " : ""}Nenhum paciente {view === "semana" ? "nesta semana" : `em ${brDate(date)}`}. Escolha um horário na grade ou use “Novo agendamento” para marcar.
                </p>
              </div>
            )}
            {view === "semana" && (
              <div role="group" aria-label="Como ver a semana" className="inline-flex rounded-full bg-slate-100 dark:bg-slate-800 p-0.5">
                {(["carga", "pacientes"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    aria-pressed={weekMode === m}
                    onClick={() => setWeekMode(m)}
                    className={`h-8 rounded-full px-3 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 ${
                      weekMode === m ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    }`}
                  >
                    {m === "carga" ? "Carga por médico" : "Pacientes"}
                  </button>
                ))}
              </div>
            )}
            {view === "semana" && weekMode === "carga" ? (
              <WeekLoadTable
                items={doctorItems}
                days={range.days}
                today={today}
                holidays={new Set(range.days.filter(isHoliday))}
                dayLabel={shortDay}
                onOpenDay={(d, doctor) => {
                  setDate(d);
                  setView("dia");
                  setSelectedDoctors(doctor ? [doctor] : []);
                }}
              />
            ) : columns.length === 0 ? (
              <div className={`${panel} p-8 text-center text-sm text-slate-500 dark:text-slate-400`}>Nenhum paciente com esses filtros.</div>
            ) : (
              <AgendaGrid
                columns={columns}
                compact={view === "semana"}
                nowTime={includesToday ? nowTime : null}
                onSlotClick={(col, time) => setSchedule({ date: col.date, time, doctor: col.doctor ?? undefined })}
                onOpen={setOpenItem}
                onSetStatus={handleSetStatus}
                onReschedule={handleReschedule}
              />
            )}
          </div>
          {/* Sempre montado: os pedidos de marcação carregam sozinhos; vazio = coluna some. */}
          <aside
            id="fila-recepcao"
            aria-label="Fila e pendências"
            className={`space-y-3 xl:sticky xl:top-3 xl:shrink-0 ${view === "semana" ? "xl:hidden" : ""} ${pendings.length > 0 || includesToday || bookingCount > 0 ? "xl:w-80" : "hidden"}`}
          >
            {includesToday && (
              <ArrivalQueue items={doctorItems} date={today} onSetStatus={handleSetStatus} onOpen={setOpenItem} />
            )}
            <BookingRequests refreshKey={reloadKey} onCount={setBookingCount} />
            <SystemPendings items={pendings} onOpen={setOpenItem} />
          </aside>
          </div>
        )}
      </div>

      <Sheet open={senhasOpen} onOpenChange={setSenhasOpen}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Senhas do totem</SheetTitle>
          </SheetHeader>
          <div className="px-4 pb-4">{senhasOpen && <QueuePanel />}</div>
        </SheetContent>
      </Sheet>

      <WaitlistDialog
        open={waitlistOpen}
        onOpenChange={setWaitlistOpen}
        doctors={doctors}
        slot={waitlistSlot?.slot ?? null}
        exceptPhone={waitlistSlot?.exceptPhone ?? null}
        onChanged={setWaitlistCount}
      />
      {helpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={() => closeHelp()}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="atalhos-agenda"
            className="w-full max-w-sm rounded-xl bg-white dark:bg-slate-900 p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              // Só há um botão: Tab fica nele (não sai do diálogo).
              if (e.key === "Tab") e.preventDefault();
            }}
          >
            <h2 id="atalhos-agenda" className="text-base font-semibold">Atalhos da Agenda</h2>
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {SHORTCUTS.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt>
                    <kbd className="rounded border border-slate-300 dark:border-slate-600 px-1.5 py-0.5 font-mono text-xs">{k}</kbd>
                  </dt>
                  <dd className="text-slate-600 dark:text-slate-300">{v}</dd>
                </div>
              ))}
            </dl>
            <button
              type="button"
              autoFocus
              onClick={() => closeHelp()}
              className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
      <PatientSheet item={openItem} onClose={() => setOpenItem(null)} onSetStatus={handleSetStatus} onReschedule={handleReschedule} />

      {schedule && (
        <ScheduleModal
          contact={{ name: schedule.patient?.name ?? "", cpf: "", phone: schedule.patient?.phone ?? "" }}
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
            const from = schedule.patient?.from;
            if (from) {
              // Crítica 02/11: o horário antigo ficava "Quer remarcar" e o lembrete era um toast.
              // Agora vira Cancelado aqui; se veio do sistema da clínica, entra nas pendências.
              applyStatus(from, "CANCELLED")
                .then(() =>
                  toast.success("Remarcado — horário antigo marcado como Cancelado.", {
                    description: from.source === "BRIDGE" ? "Cancele também no sistema da clínica (fica na lista de pendências até lá)." : undefined,
                    duration: 10000,
                    action: {
                      label: "Desfazer",
                      onClick: () => {
                        const back: AgendaStatusChoice =
                          from.isManual && from.status !== "PENDING" && from.status !== "SENT" && from.status !== "RESCHEDULE"
                            ? (from.status as AgendaStatusChoice)
                            : "AUTO";
                        applyStatus({ ...from, status: "CANCELLED", isManual: true }, back)
                          .then(reload)
                          .catch(() => toast.error("Não foi possível desfazer o cancelamento do horário antigo."));
                      },
                    },
                  })
                )
                .catch(() => toast.warning("Remarcado, mas não consegui cancelar o horário antigo — marque-o como Cancelado."))
                .finally(reload);
              return;
            }
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
