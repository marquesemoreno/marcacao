"use client";

import { useState } from "react";
import type { AppointmentStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { updateAppointmentStatus } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentStatusLabels } from "@/lib/format";

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
    return <span className="text-sm text-muted-foreground">—</span>;
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
      {actions.map((action) => (
        <Button
          key={action.status}
          type="button"
          size="sm"
          variant="outline"
          disabled={isPending}
          onClick={() => handleClick(action.status)}
        >
          {isPending && pendingStatus === action.status ? "..." : action.label}
        </Button>
      ))}
    </div>
  );
}
