import type { AgendaStatus } from "@/lib/agenda";

/** Rótulo, cores e ícone de cada status da Agenda. Cor nunca sozinha: todo status tem
 * ícone próprio (crítica 14/10/2026 — Pendente/Enviado/Remarcar e Cancelado/Falta se
 * confundiam pela cor). "Quer remarcar" tem cor própria: é o único que pede ação. */
export const AGENDA_STATUS_META: Record<AgendaStatus, { label: string; badge: string; tint: string; dot: string }> = {
  CONFIRMED: {
    label: "Confirmado",
    badge: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800",
    tint: "bg-emerald-50/70 dark:bg-emerald-950/25",
    dot: "bg-emerald-500",
  },
  PENDING: {
    label: "Pendente",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    tint: "bg-white dark:bg-slate-900",
    dot: "bg-amber-400",
  },
  SENT: {
    label: "Lembrete enviado",
    badge: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
    tint: "bg-white dark:bg-slate-900",
    dot: "bg-amber-400",
  },
  RESCHEDULE: {
    label: "Quer remarcar",
    badge: "bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800",
    tint: "bg-violet-50/80 dark:bg-violet-950/30",
    dot: "bg-violet-500",
  },
  IN_SERVICE: {
    label: "Presente",
    badge: "bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
    tint: "bg-sky-50/80 dark:bg-sky-950/30",
    dot: "bg-sky-500",
  },
  COMPLETED: {
    label: "Atendido",
    badge: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
    tint: "bg-slate-50 dark:bg-slate-900/60",
    dot: "bg-slate-400",
  },
  CANCELLED: {
    label: "Cancelado",
    badge: "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
    tint: "bg-slate-50 dark:bg-slate-900/60",
    dot: "bg-slate-400",
  },
  NO_SHOW: {
    label: "Faltou",
    badge: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800",
    tint: "bg-rose-50/70 dark:bg-rose-950/25",
    dot: "bg-rose-500",
  },
};

/** Grupos do filtro de status e da faixa de resumo (ids batem com daySummary). */
export const AGENDA_STATUS_GROUPS: { id: "confirmado" | "aguardando" | "remarcar" | "presente" | "atendido" | "falta"; label: string; statuses: AgendaStatus[]; dot: string }[] = [
  { id: "aguardando", label: "Aguardando confirmação", statuses: ["PENDING", "SENT"], dot: "bg-amber-400" },
  { id: "remarcar", label: "Quer remarcar", statuses: ["RESCHEDULE"], dot: "bg-violet-500" },
  { id: "confirmado", label: "Confirmado", statuses: ["CONFIRMED"], dot: "bg-emerald-500" },
  { id: "presente", label: "Presente", statuses: ["IN_SERVICE"], dot: "bg-sky-500" },
  { id: "atendido", label: "Atendido", statuses: ["COMPLETED"], dot: "bg-slate-400" },
  { id: "falta", label: "Faltou / cancelado", statuses: ["CANCELLED", "NO_SHOW"], dot: "bg-rose-500" },
];

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

const NAME_PARTICLES = new Set(["da", "das", "de", "do", "dos", "e"]);

/** "MARIA DA SILVA" → "Maria da Silva" (o sistema da clínica guarda tudo em maiúsculas). */
export function toTitleCase(name: string): string {
  return name
    .toLowerCase()
    .split(/(\s+)/)
    .map((w, i) => (i > 0 && NAME_PARTICLES.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join("");
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
