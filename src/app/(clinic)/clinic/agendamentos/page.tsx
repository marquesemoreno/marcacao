import type { AppointmentStatus } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusFilter } from "@/components/clinic/status-filter";
import { AppointmentActions } from "@/components/clinic/appointment-actions";
import { listClinicAppointments } from "@/actions/clinic";
import { appointmentStatusLabels, appointmentStatusVariant, formatDate } from "@/lib/format";

type AgendamentosPageProps = {
  searchParams: Promise<{ status?: string }>;
};

export default async function ClinicAppointmentsPage({ searchParams }: AgendamentosPageProps) {
  const params = await searchParams;
  const status = params.status as AppointmentStatus | undefined;
  const appointments = await listClinicAppointments({ status });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Agendamentos</h1>
      <StatusFilter basePath="/clinic/agendamentos" />

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Horário</TableHead>
              <TableHead>Paciente</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Procedimento</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  Nenhum agendamento encontrado.
                </TableCell>
              </TableRow>
            ) : (
              appointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>{formatDate(appointment.date)}</TableCell>
                  <TableCell>{appointment.timeSlot ?? "—"}</TableCell>
                  <TableCell>{appointment.patientName}</TableCell>
                  <TableCell>{appointment.patientPhone}</TableCell>
                  <TableCell>{appointment.clinicProcedure.procedure.name}</TableCell>
                  <TableCell>
                    <Badge variant={appointmentStatusVariant[appointment.status]}>
                      {appointmentStatusLabels[appointment.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <AppointmentActions appointmentId={appointment.id} status={appointment.status} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
