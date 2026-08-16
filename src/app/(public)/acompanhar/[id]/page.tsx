import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getAppointmentById } from "@/actions/appointments";
import {
  appointmentStatusLabels,
  appointmentStatusVariant,
  formatCurrency,
  formatDate,
} from "@/lib/format";

type TrackingPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TrackingPage({ params }: TrackingPageProps) {
  const { id } = await params;
  const appointment = await getAppointmentById(id);

  if (!appointment) {
    notFound();
  }

  const { clinicProcedure } = appointment;
  const { clinic, procedure } = clinicProcedure;
  const price = clinicProcedure.promotionalPrice ?? clinicProcedure.price;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold leading-tight">{procedure.name}</h1>
          <p className="text-muted-foreground">{clinic.tradeName}</p>
        </div>
        <Badge variant={appointmentStatusVariant[appointment.status]}>
          {appointmentStatusLabels[appointment.status]}
        </Badge>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Paciente</span>
            <span className="font-medium">{appointment.patientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Data solicitada</span>
            <span className="font-medium">{formatDate(appointment.date)}</span>
          </div>
          {appointment.timeSlot && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Horário</span>
              <span className="font-medium">{appointment.timeSlot}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Valor</span>
            <span className="font-medium">{formatCurrency(price.toString())}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Local</span>
            <span className="text-right font-medium">
              {clinic.address}, {clinic.neighborhood}, {clinic.city}
            </span>
          </div>
        </CardContent>
      </Card>

      {procedure.preparationInstructions && (
        <section className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/20">
          <h2 className="font-semibold">Instruções de preparo</h2>
          <p className="text-sm text-muted-foreground">{procedure.preparationInstructions}</p>
        </section>
      )}

      <p className="text-center text-xs text-muted-foreground">
        Código do agendamento: {appointment.id}
      </p>
    </main>
  );
}
