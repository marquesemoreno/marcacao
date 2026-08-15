import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ClinicDashboardPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Agenda do Dia</h1>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Horário</TableHead>
            <TableHead>Paciente</TableHead>
            <TableHead>Serviço</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground">
              Nenhum agendamento para hoje.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
