"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createAppointment } from "@/actions/appointments";
import { createAppointmentSchema, type CreateAppointmentInput } from "@/lib/schemas/appointment";
import { formatCpf, formatPhone } from "@/lib/format";
import type { PlainClinicProcedure } from "@/lib/serialize";

const timeSlots = Array.from({ length: 21 }, (_, index) => {
  const totalMinutes = 8 * 60 + index * 30;
  const hours = String(Math.floor(totalMinutes / 60)).padStart(2, "0");
  const minutes = String(totalMinutes % 60).padStart(2, "0");
  return `${hours}:${minutes}`;
});

type ConfirmedAppointment = {
  id: string;
  date: string;
  timeSlot: string | null;
};

export function BookingDialog({ clinicProcedure }: { clinicProcedure: PlainClinicProcedure }) {
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState<ConfirmedAppointment | null>(null);
  const isScheduled = clinicProcedure.appointmentType === "SCHEDULED";
  const today = new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateAppointmentInput>({
    resolver: zodResolver(createAppointmentSchema),
    defaultValues: { clinicProcedureId: clinicProcedure.id },
  });

  async function onSubmit(values: CreateAppointmentInput) {
    try {
      const appointment = await createAppointment(values);
      setConfirmed({
        id: appointment.id,
        date: appointment.date.toString(),
        timeSlot: appointment.timeSlot,
      });
    } catch {
      toast.error("Não foi possível enviar sua solicitação. Tente novamente.");
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      setConfirmed(null);
      reset({ clinicProcedureId: clinicProcedure.id });
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="lg" className="h-12 w-full text-base" />}>
        Solicitar Agendamento
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        {confirmed ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <CheckCircle2 className="h-14 w-14 text-green-600" />
            <DialogHeader>
              <DialogTitle className="text-xl">Solicitação enviada!</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Você solicitou <strong>{clinicProcedure.procedure.name}</strong> em{" "}
              <strong>{clinicProcedure.clinic.tradeName}</strong>. A clínica vai confirmar seu
              agendamento em breve.
            </p>
            {clinicProcedure.procedure.preparationInstructions && (
              <div className="w-full rounded-lg border bg-muted/50 p-3 text-left text-sm">
                <p className="font-medium">Instruções de preparo</p>
                <p className="text-muted-foreground">
                  {clinicProcedure.procedure.preparationInstructions}
                </p>
              </div>
            )}
            <div className="flex w-full flex-col gap-2 pt-2">
              <Button
                render={<Link href={`/acompanhar/${confirmed.id}`} />}
                size="lg"
                className="h-12"
              >
                Acompanhar meu agendamento
              </Button>
              <Button variant="outline" size="lg" className="h-12" onClick={() => handleOpenChange(false)}>
                Fechar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Solicitar agendamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <input type="hidden" {...register("clinicProcedureId")} />

              <div className="space-y-1.5">
                <Label htmlFor="patientName">Nome completo</Label>
                <Input id="patientName" {...register("patientName")} className="h-11" />
                {errors.patientName && (
                  <p className="text-sm text-destructive">{errors.patientName.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patientCpf">CPF</Label>
                <Input
                  id="patientCpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  className="h-11"
                  {...register("patientCpf")}
                  onChange={(event) =>
                    setValue("patientCpf", formatCpf(event.target.value), {
                      shouldValidate: true,
                    })
                  }
                  value={watch("patientCpf") ?? ""}
                />
                {errors.patientCpf && (
                  <p className="text-sm text-destructive">{errors.patientCpf.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="patientPhone">WhatsApp</Label>
                <Input
                  id="patientPhone"
                  inputMode="numeric"
                  placeholder="(00) 00000-0000"
                  className="h-11"
                  {...register("patientPhone")}
                  onChange={(event) =>
                    setValue("patientPhone", formatPhone(event.target.value), {
                      shouldValidate: true,
                    })
                  }
                  value={watch("patientPhone") ?? ""}
                />
                {errors.patientPhone && (
                  <p className="text-sm text-destructive">{errors.patientPhone.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="date">Data preferencial</Label>
                <Input
                  id="date"
                  type="date"
                  min={today}
                  className="h-11"
                  {...register("date")}
                />
                {errors.date && <p className="text-sm text-destructive">{errors.date.message}</p>}
              </div>

              {isScheduled ? (
                <div className="space-y-1.5">
                  <Label htmlFor="timeSlot">Horário preferencial</Label>
                  <Select
                    onValueChange={(value: string | null) => {
                      if (value) setValue("timeSlot", value);
                    }}
                  >
                    <SelectTrigger id="timeSlot" className="h-11">
                      <SelectValue placeholder="Escolha um horário" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.map((slot) => (
                        <SelectItem key={slot} value={slot}>
                          {slot}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <p className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                  Este atendimento é por ordem de chegada — não é necessário escolher horário.
                </p>
              )}

              <Button type="submit" size="lg" className="h-12 text-base" disabled={isSubmitting}>
                {isSubmitting ? "Enviando..." : "Confirmar solicitação"}
              </Button>
            </form>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
