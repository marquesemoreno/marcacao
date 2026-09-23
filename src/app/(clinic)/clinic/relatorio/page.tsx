import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodFilter } from "@/components/clinic/period-filter";
import { getClinicInfo, getClinicChatReport, getClinicAppointmentsReport } from "@/actions/clinic";
import { formatCurrency, appointmentStatusLabels } from "@/lib/format";
import { MessageCircle, TrendingUp, Smile, AlertTriangle, CalendarCheck, XCircle, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Formata segundos como "3 min"/"1h 20min" — mesmo helper de /admin/relatorio. */
function formatDurationLabel(seconds: number | null): string {
  if (seconds === null) return "—";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
}

type RelatorioPageProps = {
  searchParams: Promise<{ days?: string }>;
};

export default async function ClinicReportPage({ searchParams }: RelatorioPageProps) {
  const params = await searchParams;
  const days = Number(params.days) || 30;

  const clinic = await getClinicInfo();
  const isExclusive = Boolean(clinic.whatsappInstance);
  const [chatReport, appointmentsReport] = await Promise.all([
    getClinicChatReport(days),
    isExclusive ? Promise.resolve(null) : getClinicAppointmentsReport(days),
  ]);

  return (
    <div className="space-y-8 font-sans p-4 sm:p-6 flex-1 overflow-y-auto text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">📊 Relatórios da Clínica</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
            Métricas de atendimento{isExclusive ? "" : " e agendamentos"} da {clinic.tradeName}.
          </p>
        </div>
        <PeriodFilter basePath="/clinic/relatorio" />
      </div>

      {/* =========================================================================
          ATENDIMENTO / CHAT
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Atendimento / Chat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Conversas no Período</span>
              <MessageCircle className="w-5 h-5 text-sky-600" />
            </div>
            <p className="text-2xl font-extrabold font-mono">{chatReport.totalConversations}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {chatReport.totalResolved} resolvidas
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Taxa de Conversão</span>
              <TrendingUp className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl font-extrabold font-mono">{chatReport.conversionRate}%</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              {chatReport.totalAgendados} agendamentos de {chatReport.totalResolved} resolvidos
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Tempo de Resposta / Resolução</span>
              <Smile className="w-5 h-5 text-purple-600" />
            </div>
            <p className="text-lg font-extrabold font-mono">
              {formatDurationLabel(chatReport.avgFrtSec)} <span className="text-slate-400 text-xs font-normal">/</span> {formatDurationLabel(chatReport.avgTtrSec)}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">1ª resposta / resolução total</p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Urgências Acionadas</span>
              <AlertTriangle className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-2xl font-extrabold font-mono">{chatReport.urgencyCount}</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
              Sinais de emergência/reclamação grave detectados
            </p>
          </div>
        </div>

        {(chatReport.sentimentPositivePct > 0 || chatReport.sentimentNeutroPct > 0 || chatReport.sentimentNegativoPct > 0) && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Sentimento das Conversas Auditadas
            </p>
            <div className="flex gap-4 text-sm font-semibold">
              <span className="text-emerald-600">😊 {chatReport.sentimentPositivePct}% positivo</span>
              <span className="text-slate-500 dark:text-slate-400">😐 {chatReport.sentimentNeutroPct}% neutro</span>
              <span className="text-rose-600">😞 {chatReport.sentimentNegativoPct}% negativo</span>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          AGENDAMENTOS — só pra clínicas do marketplace (não exclusivas de WhatsApp)
         ========================================================================= */}
      {appointmentsReport && (
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Agendamentos
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Agendamentos no Período</span>
                <CalendarCheck className="w-5 h-5 text-sky-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono">{appointmentsReport.totalAppointments}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {appointmentsReport.countByStatus.COMPLETED} concluídos
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Cancelamento / Falta</span>
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono">{appointmentsReport.cancellationRate}%</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {appointmentsReport.countByStatus.CANCELLED} cancelados, {appointmentsReport.countByStatus.NO_SHOW} faltas
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Receita do Período</span>
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono">{formatCurrency(appointmentsReport.revenue)}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Consultas concluídas</p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Procedimentos Mais Agendados
            </p>
            {appointmentsReport.topProcedures.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nenhum agendamento no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedimento</TableHead>
                    <TableHead className="text-right">Quantidade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {appointmentsReport.topProcedures.map((p) => (
                    <TableRow key={p.name}>
                      <TableCell>{p.name}</TableCell>
                      <TableCell className="text-right font-mono">{p.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
              Agendamentos por Status
            </p>
            <div className="flex flex-wrap gap-4 text-sm font-semibold">
              {(Object.keys(appointmentsReport.countByStatus) as (keyof typeof appointmentsReport.countByStatus)[]).map((status) => (
                <span key={status} className="text-slate-600 dark:text-slate-300">
                  {appointmentStatusLabels[status]}: {appointmentsReport.countByStatus[status]}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
