"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { updateClinicBusinessHours } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import type { BusinessHours } from "@/lib/schemas/clinic";

const weekDays: { key: keyof BusinessHours; label: string }[] = [
  { key: "seg", label: "Segunda" },
  { key: "ter", label: "Terça" },
  { key: "qua", label: "Quarta" },
  { key: "qui", label: "Quinta" },
  { key: "sex", label: "Sexta" },
  { key: "sab", label: "Sábado" },
  { key: "dom", label: "Domingo" },
];

export function BusinessHoursForm({ businessHours }: { businessHours: Partial<BusinessHours> }) {
  const { isPending, run } = useActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => updateClinicBusinessHours(formData), {
      successMessage: "Horários de atendimento salvos.",
      errorMessage: "Não foi possível salvar os horários. Tente novamente.",
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-3 p-4">
          {weekDays.map(({ key, label }) => {
            const day = businessHours[key] ?? {};
            return (
              <div key={key} className="flex flex-wrap items-center gap-3 border-b pb-3 last:border-0">
                <span className="w-24 text-sm font-medium">{label}</span>
                <label className="flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    name={`${key}_closed`}
                    defaultChecked={day.closed}
                    className="h-4 w-4"
                  />
                  Fechado
                </label>
                <Input
                  type="time"
                  name={`${key}_open`}
                  defaultValue={day.open ?? "08:00"}
                  className="h-9 w-28"
                />
                <span className="text-sm text-muted-foreground">até</span>
                <Input
                  type="time"
                  name={`${key}_close`}
                  defaultValue={day.close ?? "18:00"}
                  className="h-9 w-28"
                />
              </div>
            );
          })}
          <Button type="submit" className="mt-2" disabled={isPending}>
            {isPending ? "Salvando..." : "Salvar horários"}
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
