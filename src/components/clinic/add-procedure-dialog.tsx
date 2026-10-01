"use client";

import { useRef, useState } from "react";
import type { Procedure } from "@prisma/client";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { addClinicProcedure } from "@/actions/clinic";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { appointmentTypeLabels } from "@/lib/format";
import { formatProcedureName } from "@/lib/procedure-name";

/** Botão "+ Adicionar Procedimento" + modal — substitui o card fixo no rodapé da
 * página (add-procedure-form.tsx, removido). Mesmos campos/action de antes. */
export function AddProcedureDialog({ availableProcedures }: { availableProcedures: Procedure[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => addClinicProcedure(formData), {
      successMessage: "Procedimento adicionado à tabela de preços.",
      errorMessage: "Não foi possível adicionar o procedimento. Confira os campos e tente novamente.",
      onSuccess: () => {
        formRef.current?.reset();
        setIsOpen(false);
      },
    });
  }

  if (availableProcedures.length === 0) return null;

  return (
    <>
      <Button type="button" size="sm" onClick={() => setIsOpen(true)} className="gap-1.5">
        <Plus className="w-4 h-4" /> Adicionar Procedimento
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6" showCloseButton={false}>
          <DialogClose
            aria-label="Fechar"
            render={
              <button className="absolute top-3 right-3 size-8 flex items-center justify-center rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" />
            }
          >
            <X className="w-4 h-4" />
          </DialogClose>
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-slate-900 dark:text-slate-100">Adicionar Procedimento</DialogTitle>
          </DialogHeader>

          <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 pt-2">
            <div className="col-span-2 space-y-1">
              <Label htmlFor="add-procedure-id" className="text-xs">Procedimento</Label>
              <select
                id="add-procedure-id"
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
                    {formatProcedureName(procedure.name)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-procedure-price" className="text-xs">Preço</Label>
              <Input id="add-procedure-price" type="number" step="0.01" min="0" name="price" className="h-9" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-procedure-promo-price" className="text-xs">Preço promocional</Label>
              <Input id="add-procedure-promo-price" type="number" step="0.01" min="0" name="promotionalPrice" className="h-9" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-procedure-appointment-type" className="text-xs">Atendimento</Label>
              <select
                id="add-procedure-appointment-type"
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
            <Button type="submit" size="sm" className="col-span-2" disabled={isPending}>
              {isPending ? "Adicionando..." : "Adicionar"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
