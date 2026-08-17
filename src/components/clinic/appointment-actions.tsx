"use client";

import { useState } from "react";
import type { AppointmentStatus } from "@prisma/client";
import { CheckCircle2, XCircle, CheckCheck, UserX } from "lucide-react";
import { updateAppointmentStatus } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentStatusLabels } from "@/lib/format";

const actionStyles: Record<
  AppointmentStatus,
  { icon: React.ElementType; className: string }
> = {
  CONFIRMED: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  },
  CANCELLED: {
    icon: XCircle,
    className: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
  },
  COMPLETED: {
    icon: CheckCheck,
    className: "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100",
  },
  NO_SHOW: {
    icon: UserX,
    className: "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100",
  },
  PENDING: {
    icon: CheckCircle2,
    className: "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100",
  },
};

const transitions: Record<AppointmentStatus, { status: AppointmentStatus; label: string }[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirmar" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
  CONFIRMED: [
    { status: "COMPLETED", label: "Concluir" },
    { status: "NO_SHOW", label: "Falta" },
    { status: "CANCELLED", label: "Cancelar" },
  ],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

export function AppointmentActions({
  appointmentId,
  status,
}: {
  appointmentId: string;
  status: AppointmentStatus;
}) {
  const actions = transitions[status];
  const { isPending, run } = useActionFeedback();
  const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null);

  if (actions.length === 0) {
    return <span className="text-xs text-slate-400">—</span>;
  }

  function handleClick(nextStatus: AppointmentStatus) {
    setPendingStatus(nextStatus);
    run(() => updateAppointmentStatus(appointmentId, nextStatus), {
      successMessage: `Status atualizado para "${appointmentStatusLabels[nextStatus]}".`,
      errorMessage: "Não foi possível atualizar o status. Tente novamente.",
    });
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {actions.map((action) => {
        const style = actionStyles[action.status];
        const Icon = style.icon;
        return (
          <button
            key={action.status}
            type="button"
            disabled={isPending}
            onClick={() => handleClick(action.status)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${style.className}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {isPending && pendingStatus === action.status ? "..." : action.label}
          </button>
        );
      })}
    </div>
  );
}
