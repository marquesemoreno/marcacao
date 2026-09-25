import { PeriodFilter } from "@/components/clinic/period-filter";
import { ReportSelectFilter } from "@/components/clinic/report-filters";
import { HorizontalBarChart, SentimentBar } from "@/components/clinic/report-charts";
import { ReportExportButton } from "@/components/clinic/report-export-button";
import {
  getClinicInfo,
  getClinicChatReport,
  getClinicAppointmentsReport,
  getDistinctConversationTags,
  getDistinctDoctorNames,
  listClinicProcedures,
} from "@/actions/clinic";
import { formatCurrency, appointmentStatusLabels } from "@/lib/format";
import { MessageSquare, TrendingUp, CalendarCheck, XCircle, DollarSign } from "lucide-react";

/** Cor por status — mesma semântica já usada em appointmentStatusVariant (format.ts),
 * cada família de cor distinta (nunca duas cores parecidas pra status diferentes). */
const STATUS_COLOR_CLASS = {
  PENDING: "bg-amber-500",
  CONFIRMED: "bg-sky-500",
  COMPLETED: "bg-emerald-500",
  CANCELLED: "bg-rose-500",
  NO_SHOW: "bg-slate-500",
} as const;

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
  searchParams: Promise<{ days?: string; tag?: string; doctor?: string; procedure?: string }>;
};

export default async function ClinicReportPage({ searchParams }: RelatorioPageProps) {
  const params = await searchParams;
  const days = Number(params.days) || 30;

  const clinic = await getClinicInfo();
  const isExclusive = Boolean(clinic.whatsappInstance);
  const [chatReport, appointmentsReport, tagOptions, doctorOptions, procedureOptions] = await Promise.all([
    getClinicChatReport(days, params.tag ? [params.tag] : undefined),
    isExclusive ? Promise.resolve(null) : getClinicAppointmentsReport(days, params.doctor, params.procedure),
    getDistinctConversationTags(days),
    isExclusive ? Promise.resolve([]) : getDistinctDoctorNames(),
    isExclusive ? Promise.resolve([]) : listClinicProcedures(),
  ]);

  return (
    <div className="space-y-8 font-sans flex-1 overflow-y-auto text-slate-900 dark:text-slate-100 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Relatórios de Atendimento</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Métricas consolidadas de desempenho e recepção da {clinic.tradeName}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ReportSelectFilter
            basePath="/clinic/relatorio"
            paramKey="tag"
            placeholder="Tag"
            options={[{ value: "_all", label: "Todas as tags" }, ...tagOptions.map((t) => ({ value: t, label: t }))]}
          />
          <PeriodFilter basePath="/clinic/relatorio" />
          <ReportExportButton
            rows={[
              ["Conversas no período", chatReport.totalConversations],
              ["Conversas resolvidas", chatReport.totalResolved],
              ["Taxa de conversão em agendamento (%)", chatReport.conversionRate],
              ["Tempo médio de 1ª resposta (s)", chatReport.avgFrtSec ?? "—"],
              ["Tempo médio de resolução (s)", chatReport.avgTtrSec ?? "—"],
              ["Sentimento positivo (%)", chatReport.sentimentPositivePct],
              ["Sentimento neutro (%)", chatReport.sentimentNeutroPct],
              ["Sentimento negativo (%)", chatReport.sentimentNegativoPct],
              ...(appointmentsReport
                ? ([
                    ["Agendamentos no período", appointmentsReport.totalAppointments],
                    ["Taxa de cancelamento/falta (%)", appointmentsReport.cancellationRate],
                    ["Receita do período (R$)", appointmentsReport.revenue],
                  ] as [string, string | number][])
                : []),
            ]}
          />
        </div>
      </div>

      {/* =========================================================================
          ATENDIMENTO / CHAT
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Atendimento / Chat
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total de Conversas</span>
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{chatReport.totalConversations}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {chatReport.totalResolved} resolvidas no período
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Conversão em Agendamento</span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{chatReport.conversionRate}%</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {chatReport.totalAgendados} de {chatReport.totalResolved} resolvidos
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Tempo Médio de Atendimento</span>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">1ª Resposta</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatDurationLabel(chatReport.avgFrtSec)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Resolução Total</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatDurationLabel(chatReport.avgTtrSec)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Sentimento das Conversas Auditadas
          </p>
          <SentimentBar
            positivePct={chatReport.sentimentPositivePct}
            neutroPct={chatReport.sentimentNeutroPct}
            negativoPct={chatReport.sentimentNegativoPct}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {chatReport.sentimentAuditedCount} conversa(s) auditada(s) por IA / regras automáticas no período.
          </p>
        </div>
      </div>

      {/* =========================================================================
          AGENDAMENTOS — só pra clínicas do marketplace (não exclusivas de WhatsApp)
         ========================================================================= */}
      {appointmentsReport && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Agendamentos
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <ReportSelectFilter
                basePath="/clinic/relatorio"
                paramKey="doctor"
                placeholder="Médico"
                options={[{ value: "_all", label: "Todos os médicos" }, ...doctorOptions.map((d) => ({ value: d, label: d }))]}
              />
              <ReportSelectFilter
                basePath="/clinic/relatorio"
                paramKey="procedure"
                placeholder="Procedimento"
                options={[
                  { value: "_all", label: "Todos os procedimentos" },
                  ...procedureOptions.map((cp) => ({ value: cp.procedureId, label: cp.procedure.name })),
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Agendamentos no Período</span>
                <CalendarCheck className="w-5 h-5 text-sky-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono">{appointmentsReport.totalAppointments}</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {appointmentsReport.countByStatus.COMPLETED} concluídos
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-bold uppercase tracking-wider">Cancelamento / Falta</span>
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-2xl font-extrabold font-mono">{appointmentsReport.cancellationRate}%</p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {appointmentsReport.countByStatus.CANCELLED} cancelados, {appointmentsReport.countByStatus.NO_SHOW} faltas
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
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
            <HorizontalBarChart
              data={appointmentsReport.topProcedures.map((p) => ({ label: p.name, value: p.count, colorClass: "bg-sky-500" }))}
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-5 shadow-2xs space-y-3">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Agendamentos por Status
            </p>
            <HorizontalBarChart
              data={(Object.keys(appointmentsReport.countByStatus) as (keyof typeof appointmentsReport.countByStatus)[]).map((status) => ({
                label: appointmentStatusLabels[status],
                value: appointmentsReport.countByStatus[status],
                colorClass: STATUS_COLOR_CLASS[status],
              }))}
            />
          </div>
        </div>
      )}
    </div>
  );
}
