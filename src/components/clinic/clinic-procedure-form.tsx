"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { updateClinicProcedure } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentTypeLabels, categoryLabels } from "@/lib/format";
import type { PlainClinicProcedureItem } from "@/lib/serialize";

export function ClinicProcedureForm({ item }: { item: PlainClinicProcedureItem }) {
  const { isPending, run } = useActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => updateClinicProcedure(item.id, formData), {
      successMessage: `Preço de "${item.procedure.name}" atualizado.`,
      errorMessage: "Não foi possível salvar. Confira os valores e tente novamente.",
    });
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {item.procedure.name}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({categoryLabels[item.procedure.category]})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:items-end">
          <div className="space-y-1">
            <Label className="text-xs">Preço</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              name="price"
              defaultValue={item.price.toString()}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Preço promocional</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              name="promotionalPrice"
              defaultValue={item.promotionalPrice?.toString() ?? ""}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Atendimento</Label>
            <select
              name="appointmentType"
              defaultValue={item.appointmentType}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
            >
              {Object.entries(appointmentTypeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-sm">
              <input
                type="checkbox"
                name="requiresAppointment"
                defaultChecked={item.requiresAppointment}
                className="h-4 w-4"
              />
              Requer agendamento
            </label>
          </div>
          <Button type="submit" size="sm" className="col-span-2 sm:col-span-4" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
