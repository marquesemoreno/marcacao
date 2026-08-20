"use client";

import { useState } from "react";
import type { AppointmentStatus } from "@prisma/client";
import { CheckCircle2, XCircle, CheckCheck, UserX, Send } from "lucide-react";
import { updateAppointmentStatus } from "@/actions/clinic";
import { sendAppointmentReminder } from "@/actions/reminders";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentStatusLabels } from "@/lib/format";
import { toast } from "sonner";

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
  reminderStatus,
}: {
  appointmentId: string;
  status: AppointmentStatus;
  reminderStatus?: string | null;
}) {
  const actions = transitions[status];
  const { isPending, run } = useActionFeedback();
  const [pendingStatus, setPendingStatus] = useState<AppointmentStatus | null>(null);
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  async function handleSendReminder() {
    setIsSendingReminder(true);
    try {
      const res = await sendAppointmentReminder(appointmentId);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch {
      toast.error("Erro ao enviar lembrete.");
    } finally {
      setIsSendingReminder(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <button
        type="button"
        disabled={isSendingReminder || status === "CANCELLED" || status === "COMPLETED"}
        onClick={handleSendReminder}
        className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50 shadow-2xs"
        title="Enviar lembrete via WhatsApp para o paciente"
      >
        <Send className="h-3.5 w-3.5 text-emerald-600" />
        {isSendingReminder ? "Enviando..." : reminderStatus === "SENT" ? "Reenviar Lembrete" : "Disparar Lembrete"}
      </button>

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

  function handleClick(nextStatus: AppointmentStatus) {
    setPendingStatus(nextStatus);
    run(() => updateAppointmentStatus(appointmentId, nextStatus), {
      successMessage: `Status atualizado para "${appointmentStatusLabels[nextStatus]}".`,
      errorMessage: "Não foi possível atualizar o status. Tente novamente.",
    });
  }
}
