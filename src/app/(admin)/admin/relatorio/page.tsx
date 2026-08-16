import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getFinancialReport } from "@/actions/admin";
import { formatCurrency } from "@/lib/format";

export default async function AdminFinancialReportPage() {
  const report = await getFinancialReport();

  const totals = report.reduce(
    (acc, clinic) => ({
      appointments: acc.appointments + clinic.totalAppointments,
      revenue: acc.revenue + clinic.revenue,
      commission: acc.commission + clinic.commission,
    }),
    { appointments: 0, revenue: 0, commission: 0 }
  );

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Relatório Financeiro</h1>
      <p className="text-sm text-muted-foreground">
        Receita e comissão calculadas sobre agendamentos com status <strong>Concluído</strong>,
        usando o preço vigente de cada procedimento.
      </p>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Clínica</TableHead>
              <TableHead>Agendamentos</TableHead>
              <TableHead>Concluídos</TableHead>
              <TableHead>Receita</TableHead>
              <TableHead>Comissão</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {report.map((clinic) => (
              <TableRow key={clinic.id}>
                <TableCell>{clinic.tradeName}</TableCell>
                <TableCell>{clinic.totalAppointments}</TableCell>
                <TableCell>{clinic.completedCount}</TableCell>
                <TableCell>{formatCurrency(clinic.revenue)}</TableCell>
                <TableCell>
                  {formatCurrency(clinic.commission)}{" "}
                  <span className="text-xs text-muted-foreground">
                    ({clinic.commissionRate.toFixed(2)}%)
                  </span>
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="font-semibold">
              <TableCell>Total</TableCell>
              <TableCell>{totals.appointments}</TableCell>
              <TableCell>—</TableCell>
              <TableCell>{formatCurrency(totals.revenue)}</TableCell>
              <TableCell>{formatCurrency(totals.commission)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
