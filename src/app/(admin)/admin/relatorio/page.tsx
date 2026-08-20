import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { getFinancialReport, getAttendantPerformanceReport } from "@/actions/admin";
import { formatCurrency } from "@/lib/format";
import { Clock, Trophy, CheckCircle2, XCircle, TrendingUp, Users, Award } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminReportPage() {
  const [financialReport, attendantReport] = await Promise.all([
    getFinancialReport(),
    getAttendantPerformanceReport(),
  ]);

  const totals = financialReport.reduce(
    (acc, clinic) => ({
      appointments: acc.appointments + clinic.totalAppointments,
      revenue: acc.revenue + clinic.revenue,
      commission: acc.commission + clinic.commission,
    }),
    { appointments: 0, revenue: 0, commission: 0 }
  );

  const { overview, attendantStats } = attendantReport;

  return (
    <div className="space-y-8 font-sans">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
          📊 Relatório Avançado de Produtividade & Finanças
        </h1>
        <p className="text-xs text-slate-500 font-medium mt-1">
          Métricas de tempo de resposta (TMR), taxa de conversão da recepção e faturamento por clínica.
        </p>
      </div>

      {/* =========================================================================
          CARDS DE MÉTRICAS DE DESEMPENHO DA EQUIPE (TMR & RANKING)
         ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Tempo Médio de Resposta (TMR)</span>
            <Clock className="w-5 h-5 text-sky-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900">
            ~{overview.tmrMinutes} min
          </p>
          <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" /> Tempo excelente de triagem
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Taxa de Conversão em Consultas</span>
            <TrendingUp className="w-5 h-5 text-emerald-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900">
            {overview.globalConversionRate}%
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {overview.totalAgendados} agendamentos de {overview.totalResolved} resolvidos
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Atendente Destaque</span>
            <Trophy className="w-5 h-5 text-amber-500 animate-bounce" />
          </div>
          <p className="text-xl font-extrabold text-slate-900 truncate">
            🥇 {overview.topAttendant}
          </p>
          <p className="text-[11px] text-amber-600 font-semibold">
            Maior taxa de agendamentos da recepção
          </p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Concluídos</span>
            <CheckCircle2 className="w-5 h-5 text-purple-600" />
          </div>
          <p className="text-2xl font-extrabold font-mono text-slate-900">
            {overview.totalResolved}
          </p>
          <p className="text-[11px] text-slate-500 font-medium">
            {overview.totalCancelados} cancelamentos registrados
          </p>
        </div>
      </div>

      {/* =========================================================================
          RANKING DE DESEMPENHO DA RECEPÇÃO (TABELA DE ATENDENTES)
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-5 h-5 text-emerald-600" />
            Ranking de Produtividade & Conversão da Recepção
          </h2>
          <span className="text-xs font-mono font-semibold bg-slate-100 px-2.5 py-1 rounded-full text-slate-600 border border-slate-200">
            {attendantStats.length} atendente{attendantStats.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-xs">Atendente / Secretária</TableHead>
                <TableHead className="font-bold text-xs">Clínica</TableHead>
                <TableHead className="font-bold text-xs">Atendimentos Assumidos</TableHead>
                <TableHead className="font-bold text-xs">Em Aberto Agora</TableHead>
                <TableHead className="font-bold text-xs">Concluídos</TableHead>
                <TableHead className="font-bold text-xs">Conversão em Agendamento</TableHead>
                <TableHead className="font-bold text-xs">Desfechos (Agendado vs Cancelado)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {attendantStats.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    Nenhum atendente registrado até o momento.
                  </TableCell>
                </TableRow>
              ) : (
                attendantStats.map((attendant, idx) => (
                  <TableRow key={attendant.id} className="hover:bg-slate-50/80 transition-colors">
                    <TableCell className="font-bold text-slate-900 text-xs flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 text-[11px] font-mono flex items-center justify-center font-bold">
                        {idx + 1}
                      </span>
                      <span>{attendant.name}</span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">{attendant.clinicName}</TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-800">
                      {attendant.assignedCount}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-semibold text-slate-600">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                        ⚡ {attendant.openCount}/{attendant.maxConcurrentChats}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold text-slate-800">
                      {attendant.resolvedCount}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-extrabold text-emerald-700">
                      {attendant.conversionRate}%
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-emerald-700 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> {attendant.reasonsCount.AGENDAMENTO_CONCLUIDO} agendados
                        </span>
                        <span className="text-rose-600 font-medium flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> {attendant.reasonsCount.CANCELAMENTO} cancelados
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* =========================================================================
          RELATÓRIO FINANCEIRO POR CLÍNICA
         ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Relatório Financeiro por Clínica</h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Receita e comissão calculadas sobre agendamentos com status <strong>Concluído</strong>.
          </p>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <Table>
            <TableHeader className="bg-slate-50">
              <TableRow>
                <TableHead className="font-bold text-xs">Clínica</TableHead>
                <TableHead className="font-bold text-xs">Agendamentos</TableHead>
                <TableHead className="font-bold text-xs">Concluídos</TableHead>
                <TableHead className="font-bold text-xs">Receita</TableHead>
                <TableHead className="font-bold text-xs">Comissão Plataforma</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {financialReport.map((clinic) => (
                <TableRow key={clinic.id}>
                  <TableCell className="font-bold text-slate-900 text-xs">{clinic.tradeName}</TableCell>
                  <TableCell className="font-mono text-xs">{clinic.totalAppointments}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-700">{clinic.completedCount}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-900">{formatCurrency(clinic.revenue)}</TableCell>
                  <TableCell className="font-mono text-xs font-bold text-purple-700">
                    {formatCurrency(clinic.commission)}{" "}
                    <span className="text-[10px] text-slate-400 font-normal">
                      ({clinic.commissionRate.toFixed(2)}%)
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-extrabold bg-slate-50/80">
                <TableCell className="text-xs">Total Consolidado</TableCell>
                <TableCell className="font-mono text-xs">{totals.appointments}</TableCell>
                <TableCell className="font-mono text-xs">—</TableCell>
                <TableCell className="font-mono text-xs text-emerald-800">{formatCurrency(totals.revenue)}</TableCell>
                <TableCell className="font-mono text-xs text-purple-800">{formatCurrency(totals.commission)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
