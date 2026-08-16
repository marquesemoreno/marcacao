"use client";

import { useEffect, useState } from "react";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { listClinicProceduresForAppointment } from "@/actions/inbox";
import { createAppointment } from "@/actions/appointments";
import { formatCurrency, appointmentTypeLabels } from "@/lib/format";
import type { PlainClinicProcedureItem } from "@/lib/serialize";

export function CreateAppointmentShortcut({
  contact,
}: {
  contact: { name: string; phone: string; cpf: string | null };
}) {
  const [open, setOpen] = useState(false);
  const [procedures, setProcedures] = useState<PlainClinicProcedureItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [procedureId, setProcedureId] = useState("");
  const [date, setDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [cpf, setCpf] = useState(contact.cpf ?? "");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listClinicProceduresForAppointment()
      .then(setProcedures)
      .finally(() => setLoading(false));
  }, [open]);

  const selectedProcedure = procedures.find((p) => p.id === procedureId);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!procedureId || !date) return;
    setSubmitting(true);
    try {
      await createAppointment({
        patientName: contact.name,
        patientCpf: cpf,
        patientPhone: contact.phone,
        clinicProcedureId: procedureId,
        date,
        timeSlot: timeSlot || undefined,
      });
      toast.success("Agendamento criado para o paciente.");
      setOpen(false);
      setProcedureId("");
      setDate("");
      setTimeSlot("");
    } catch {
      toast.error("Não foi possível criar o agendamento. Confira os dados (CPF precisa ter 11 dígitos).");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" className="w-full justify-start gap-2" />}>
        <CalendarPlus className="h-4 w-4" />
        Criar Agendamento de Consulta/Exame
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Novo agendamento para {contact.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Nome</Label>
            <Input value={contact.name} disabled className="h-9" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={contact.phone} disabled className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">CPF</Label>
              <Input
                value={cpf}
                onChange={(event) => setCpf(event.target.value)}
                placeholder="000.000.000-00"
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Procedimento</Label>
            <select
              value={procedureId}
              onChange={(event) => setProcedureId(event.target.value)}
              className="h-9 w-full rounded-lg border border-input bg-transparent px-2 text-sm"
              required
              disabled={loading}
            >
              <option value="" disabled>
                {loading ? "Carregando..." : "Escolha..."}
              </option>
              {procedures.map((procedure) => (
                <option key={procedure.id} value={procedure.id}>
                  {procedure.procedure.name} — {formatCurrency(procedure.promotionalPrice ?? procedure.price)}
                </option>
              ))}
            </select>
          </div>

          {selectedProcedure && (
            <p className="text-xs text-muted-foreground">
              {appointmentTypeLabels[selectedProcedure.appointmentType]}
              {selectedProcedure.procedure.preparationInstructions &&
                ` · Preparo: ${selectedProcedure.procedure.preparationInstructions}`}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={date}
                onChange={(event) => setDate(event.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="h-9"
                required
              />
            </div>
            {selectedProcedure?.appointmentType === "SCHEDULED" && (
              <div className="space-y-1">
                <Label className="text-xs">Horário</Label>
                <Input
                  type="time"
                  value={timeSlot}
                  onChange={(event) => setTimeSlot(event.target.value)}
                  className="h-9"
                />
              </div>
            )}
          </div>

          <Button type="submit" disabled={submitting || !procedureId || !date}>
            {submitting ? "Criando..." : "Criar agendamento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
