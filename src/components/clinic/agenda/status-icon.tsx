import { CalendarClock, CheckCheck, CircleCheck, CircleDashed, Send, UserCheck, UserX, XCircle, type LucideIcon } from "lucide-react";
import type { AgendaStatus } from "@/lib/agenda";

const ICONS: Record<AgendaStatus, LucideIcon> = {
  CONFIRMED: CircleCheck,
  PENDING: CircleDashed,
  SENT: Send,
  RESCHEDULE: CalendarClock,
  IN_SERVICE: UserCheck,
  COMPLETED: CheckCheck,
  CANCELLED: XCircle,
  NO_SHOW: UserX,
};

const COLORS: Record<AgendaStatus, string> = {
  CONFIRMED: "text-emerald-600 dark:text-emerald-400",
  PENDING: "text-amber-500 dark:text-amber-400",
  SENT: "text-amber-500 dark:text-amber-400",
  RESCHEDULE: "text-violet-600 dark:text-violet-400",
  IN_SERVICE: "text-sky-600 dark:text-sky-400",
  COMPLETED: "text-slate-500 dark:text-slate-400",
  CANCELLED: "text-slate-400 dark:text-slate-500",
  NO_SHOW: "text-rose-600 dark:text-rose-400",
};

/** Ícone do status — forma diferente pra cada um, pra não depender só da cor. */
export function StatusIcon({ status, className = "w-3.5 h-3.5" }: { status: AgendaStatus; className?: string }) {
  const Icon = ICONS[status];
  return <Icon className={`${className} shrink-0 ${COLORS[status]}`} aria-hidden />;
}
