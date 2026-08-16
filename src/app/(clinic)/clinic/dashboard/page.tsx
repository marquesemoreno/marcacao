import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getClinicOverview, listClinicAppointments } from "@/actions/clinic";
import { AppointmentActions } from "@/components/clinic/appointment-actions";
import { appointmentStatusLabels, appointmentStatusVariant } from "@/lib/format";
import { startOfUTCDay } from "@/lib/date";

export default async function ClinicDashboardPage() {
  const [overview, appointments] = await Promise.all([
    getClinicOverview(),
    listClinicAppointments(),
  ]);

  const todayStart = startOfUTCDay(new Date()).toISOString();
  const todayAppointments = appointments.filter(
    (appointment) => appointment.date.toISOString() === todayStart
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visão Geral</h1>

      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Hoje</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{overview.todayCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Esta semana</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{overview.weekCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{overview.pendingCount}</CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Agenda de hoje</h2>
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Horário</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Procedimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {todayAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    Nenhum agendamento para hoje.
                  </TableCell>
                </TableRow>
              ) : (
                todayAppointments.map((appointment) => (
                  <TableRow key={appointment.id}>
                    <TableCell>{appointment.timeSlot ?? "—"}</TableCell>
                    <TableCell>{appointment.patientName}</TableCell>
                    <TableCell>{appointment.clinicProcedure.procedure.name}</TableCell>
                    <TableCell>
                      <Badge variant={appointmentStatusVariant[appointment.status]}>
                        {appointmentStatusLabels[appointment.status]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <AppointmentActions
                        appointmentId={appointment.id}
                        status={appointment.status}
                      />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
