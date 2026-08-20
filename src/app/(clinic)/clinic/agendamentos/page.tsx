import type { AppointmentStatus } from "@prisma/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { StatusFilter } from "@/components/clinic/status-filter";
import { AppointmentActions } from "@/components/clinic/appointment-actions";
import { BatchReminderButton } from "@/components/clinic/batch-reminder-button";
import { listClinicAppointments } from "@/actions/clinic";
import { appointmentStatusLabels, appointmentStatusVariant, formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AgendamentosPageProps = {
  searchParams: Promise<{ status?: string }>;
};

function getReminderBadge(reminderStatus?: string | null) {
  switch (reminderStatus) {
    case "SENT":
      return <Badge className="bg-sky-100 text-sky-800 border-sky-200">✉️ Lembrete Enviado</Badge>;
    case "CONFIRMED":
      return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">✅ Confirmado</Badge>;
    case "RESCHEDULE_REQUESTED":
      return <Badge className="bg-amber-100 text-amber-800 border-amber-200">🔄 Reagendar</Badge>;
    default:
      return <Badge className="bg-slate-100 text-slate-600 border-slate-200">⏳ Pendente Envio</Badge>;
  }
}

export default async function ClinicAppointmentsPage({ searchParams }: AgendamentosPageProps) {
  const params = await searchParams;
  const status = params.status as AppointmentStatus | undefined;
  const appointments = await listClinicAppointments({ status });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Agendamentos de Hoje e Consultas</h1>
        <BatchReminderButton />
      </div>

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
              <TableHead>Status Consulta</TableHead>
              <TableHead>Lembrete WhatsApp</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
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
                  <TableCell>{getReminderBadge(appointment.reminderStatus)}</TableCell>
                  <TableCell>
                    <AppointmentActions
                      appointmentId={appointment.id}
                      status={appointment.status}
                      reminderStatus={appointment.reminderStatus}
                    />
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
