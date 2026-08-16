"use client";

import { useRef } from "react";
import type { Procedure } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { addClinicProcedure } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentTypeLabels } from "@/lib/format";

export function AddProcedureForm({ availableProcedures }: { availableProcedures: Procedure[] }) {
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => addClinicProcedure(formData), {
      successMessage: "Procedimento adicionado à tabela de preços.",
      errorMessage: "Não foi possível adicionar o procedimento. Confira os campos e tente novamente.",
      onSuccess: () => formRef.current?.reset(),
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end"
        >
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label className="text-xs">Procedimento</Label>
            <select
              name="procedureId"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              defaultValue=""
              required
            >
              <option value="" disabled>
                Escolha...
              </option>
              {availableProcedures.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço</Label>
            <Input type="number" step="0.01" min="0" name="price" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço promocional</Label>
            <Input type="number" step="0.01" min="0" name="promotionalPrice" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Atendimento</Label>
            <select
              name="appointmentType"
              defaultValue="SCHEDULED"
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="checkbox" name="requiresAppointment" defaultChecked className="h-4 w-4" />
            Requer agendamento
          </label>
          <Button type="submit" size="sm" className="col-span-2 sm:col-span-4" disabled={isPending}>
            {isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
