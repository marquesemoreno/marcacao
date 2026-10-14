import type { AgendaStatus } from "@/lib/agenda";

/** Rótulo e cores (semáforo) de cada status da Agenda — legenda, cards e filtros. */
export const AGENDA_STATUS_META: Record<AgendaStatus, { label: string; badge: string; card: string }> = {
  CONFIRMED: {
    label: "Confirmado",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    card: "border-l-emerald-500",
  },
  PENDING: {
    label: "Pendente",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    card: "border-l-amber-400",
  },
  SENT: {
    label: "Lembrete enviado",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    card: "border-l-amber-400",
  },
  RESCHEDULE: {
    label: "Quer remarcar",
    badge: "bg-amber-100 text-amber-900 border-amber-400 dark:bg-amber-950/60 dark:text-amber-200 dark:border-amber-700",
    card: "border-l-amber-600",
  },
  IN_SERVICE: {
    label: "Presente",
    badge: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    card: "border-l-sky-500",
  },
  COMPLETED: {
    label: "Atendido",
    badge: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    card: "border-l-slate-400",
  },
  CANCELLED: {
    label: "Cancelado",
    badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    card: "border-l-rose-500",
  },
  NO_SHOW: {
    label: "Falta",
    badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    card: "border-l-rose-500",
  },
};

/** Grupos do filtro de status e da legenda. */
export const AGENDA_STATUS_GROUPS: { id: string; label: string; statuses: AgendaStatus[]; dot: string }[] = [
  { id: "confirmado", label: "Confirmado", statuses: ["CONFIRMED"], dot: "bg-emerald-500" },
  { id: "aguardando", label: "Aguardando confirmação", statuses: ["PENDING", "SENT", "RESCHEDULE"], dot: "bg-amber-400" },
  { id: "presente", label: "Presente / em atendimento", statuses: ["IN_SERVICE"], dot: "bg-sky-500" },
  { id: "atendido", label: "Atendido", statuses: ["COMPLETED"], dot: "bg-slate-400" },
  { id: "falta", label: "Cancelado / falta", statuses: ["CANCELLED", "NO_SHOW"], dot: "bg-rose-500" },
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function toTitleCase(name: string): string {
  return name.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

/** "quarta-feira, 14 de outubro de 2026" */
export function formatLongDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function todayInBahia(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}
