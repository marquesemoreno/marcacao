"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateClinic } from "@/actions/admin";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import type { PlainClinic } from "@/lib/serialize";

export function UpdateClinicForm({ clinic }: { clinic: PlainClinic }) {
  const { isPending, run } = useActionFeedback();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => updateClinic(clinic.id, formData), {
      successMessage: `${clinic.tradeName} atualizada.`,
      errorMessage: "Não foi possível salvar. Tente novamente.",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Comissão (%)</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          max="100"
          name="commissionRate"
          defaultValue={clinic.commissionRate.toString()}
          className="h-9 w-28"
        />
      </div>
      <label className="flex items-center gap-1.5 pb-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={clinic.active} className="h-4 w-4" />
        Ativa
      </label>
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Salvando..." : "Salvar"}
      </Button>
    </form>
  );
}
