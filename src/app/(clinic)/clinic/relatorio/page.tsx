import { PeriodFilter } from "@/components/clinic/period-filter";
import { PageHeader } from "@/components/clinic/page-header";
import { ReportSelectFilter } from "@/components/clinic/report-filters";
import {
  HorizontalBarChart,
  SentimentBar,
  VerticalBarChart,
} from "@/components/clinic/report-charts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ReportExportButton } from "@/components/clinic/report-export-button";
import {
  getClinicInfo,
  getClinicChatReport,
  getClinicAppointmentsReport,
  getClinicManagementReport,
  getDistinctConversationTags,
  getDistinctDoctorNames,
  getDistinctAcquisitionChannels,
  listClinicProcedures,
  getClinicCampaignReport,
} from "@/actions/clinic";
import Link from "next/link";
import { isProcedureAgenda } from "@/lib/doctor-names";
import { formatDurationHuman, SLA_CRITICAL_MINUTES, SLA_WARNING_MINUTES } from "@/lib/sla-calculator";
import { ReportDelta } from "@/components/clinic/report-delta";
import { UNIDENTIFIED_CHANNEL } from "@/lib/report-metrics";
import { formatCurrency, appointmentStatusLabels } from "@/lib/format";
import {
  MessageSquare,
  TrendingUp,
  CalendarCheck,
  XCircle,
  DollarSign,
  CheckCircle2,
  RotateCcw,
  Clock,
  ShieldCheck,
  Wallet,
  Megaphone,
} from "lucide-react";

export const metadata = { title: "Relatórios" };

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


type RelatorioPageProps = {
  searchParams: Promise<{
    days?: string;
    tag?: string;
    doctor?: string;
    procedure?: string;
    channel?: string;
  }>;
};

export default async function ClinicReportPage({
  searchParams,
}: RelatorioPageProps) {
  const params = await searchParams;
  const days = Number(params.days) || 30;

  const clinic = await getClinicInfo();
  const isExclusive = Boolean(clinic.whatsappInstance);
  const [
    chatReport,
    appointmentsReport,
    tagOptions,
    doctorOptions,
    procedureOptions,
    management,
    channelOptions,
    campaigns,
    prevChat,
    prevManagement,
  ] = await Promise.all([
    getClinicChatReport(days, params.tag ? [params.tag] : undefined, params.channel),
    isExclusive
      ? Promise.resolve(null)
      : getClinicAppointmentsReport(days, params.doctor, params.procedure),
    getDistinctConversationTags(days),
    isExclusive ? Promise.resolve([]) : getDistinctDoctorNames(),
    isExclusive ? Promise.resolve([]) : listClinicProcedures(),
    getClinicManagementReport(days, params.channel),
    getDistinctAcquisitionChannels(days),
    getClinicCampaignReport(days),
    // Mesma janela imediatamente antes — comparação ("↑ 8 pts vs 30 dias anteriores").
    getClinicChatReport(days, params.tag ? [params.tag] : undefined, params.channel, true),
    getClinicManagementReport(days, params.channel, true),
  ]);
  const rs = chatReport.responseStats;
  const prevRs = prevChat.responseStats;
  // Resumo do período: as 3 perguntas do gestor, respondidas antes de qualquer detalhe.
  const topChannel = management.channelConversion.find(
    (c) => c.scheduled > 0 && c.channel !== UNIDENTIFIED_CHANNEL,
  );
  const slaTone = (min: number | null) =>
    min === null
      ? "text-slate-900 dark:text-slate-100"
      : min <= SLA_WARNING_MINUTES
        ? "text-emerald-700 dark:text-emerald-400"
        : min <= SLA_CRITICAL_MINUTES
          ? "text-amber-700 dark:text-amber-400"
          : "text-rose-700 dark:text-rose-400";
  const topAttendantId = management.attendants.find(
    (a) => a.scheduled > 0,
  )?.userId;
  const kindTotal =
    management.kindDistribution.CONSULTA +
    management.kindDistribution.RETORNO +
    management.kindDistribution.EXAME;

  return (
    <div className="space-y-8 font-sans flex-1 overflow-y-auto text-slate-900 dark:text-slate-100 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <PageHeader
          title="Relatórios"
          subtitle={`${chatReport.totalConversations} conversa(s) nos últimos ${days} dias · ${clinic.tradeName}`}
        />
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <ReportSelectFilter
            basePath="/clinic/relatorio"
            paramKey="tag"
            placeholder="Tag"
            options={[
              { value: "_all", label: "Todas as tags" },
              ...tagOptions.map((t) => ({ value: t, label: t })),
            ]}
          />
          <ReportSelectFilter
            basePath="/clinic/relatorio"
            paramKey="channel"
            placeholder="Canal de aquisição"
            options={[
              { value: "_all", label: "Todos os canais" },
              ...channelOptions.map((c) => ({ value: c, label: c })),
            ]}
          />
          <PeriodFilter basePath="/clinic/relatorio" />
          <ReportExportButton
            rows={[
              ["Conversas no período", chatReport.totalConversations],
              ["Conversas resolvidas", chatReport.totalResolved],
              [
                "Taxa de conversão em agendamento (%)",
                chatReport.conversionRate,
              ],
              ["Mediana de 1ª resposta (min, horário comercial)", rs.medianFirstResponseMin ?? "—"],
              ["Mediana de resolução (min, horário comercial)", rs.medianResolutionMin ?? "—"],
              [`Respondidas em até ${SLA_WARNING_MINUTES} min (%)`, rs.withinSlaPct ?? "—"],
              ["Sentimento positivo (%)", chatReport.sentimentPositivePct],
              ["Sentimento neutro (%)", chatReport.sentimentNeutroPct],
              ["Sentimento negativo (%)", chatReport.sentimentNegativoPct],
              ["Faturamento estimado (R$)", management.estimatedRevenue ?? "—"],
              ["Receita protegida (R$)", management.protectedRevenue ?? "—"],
              ...management.channelConversion.map(
                (c) =>
                  [`Agendamentos via ${c.channel}`, c.scheduled] as [string, string | number],
              ),
              ...(appointmentsReport
                ? ([
                    [
                      "Agendamentos no período",
                      appointmentsReport.totalAppointments,
                    ],
                    [
                      "Taxa de cancelamento/falta (%)",
                      appointmentsReport.cancellationRate,
                    ],
                    ["Receita do período (R$)", appointmentsReport.revenue],
                  ] as [string, string | number][])
                : []),
            ]}
          />
        </div>
      </div>

      {/* =========================================================================
          RESUMO DO PERÍODO — as 3 perguntas do gestor, com comparação
         ========================================================================= */}
      <section aria-labelledby="resumo-titulo" className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
        <h2 id="resumo-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Resumo dos últimos {days} dias
        </h2>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="space-y-1 sm:pr-5">
            <dt className="text-sm text-slate-600 dark:text-slate-400">Respondidas em até {SLA_WARNING_MINUTES} min</dt>
            <dd className={`text-3xl font-bold tabular-nums ${rs.withinSlaPct === null ? "text-slate-900 dark:text-slate-100" : rs.withinSlaPct >= 80 ? "text-emerald-700 dark:text-emerald-400" : rs.withinSlaPct >= 50 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}>
              {rs.withinSlaPct !== null ? `${rs.withinSlaPct}%` : "—"}
            </dd>
            <dd>
              <ReportDelta current={rs.withinSlaPct} previous={prevRs.withinSlaPct} unit="pts" better="up" days={days} />
            </dd>
            {rs.withinSlaPct === null && (
              <dd className="text-xs text-slate-600 dark:text-slate-400">Nenhuma conversa respondida pela equipe no período.</dd>
            )}
          </div>
          <div className="space-y-1 sm:px-5">
            <dt className="text-sm text-slate-600 dark:text-slate-400">Pacientes que confirmaram o lembrete</dt>
            <dd className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {management.confirmations.totalSent > 0 ? `${management.confirmations.confirmedPct}%` : "—"}
            </dd>
            <dd>
              <ReportDelta
                current={management.confirmations.totalSent > 0 ? management.confirmations.confirmedPct : null}
                previous={prevManagement.confirmations.totalSent > 0 ? prevManagement.confirmations.confirmedPct : null}
                unit="pts"
                better="up"
                days={days}
              />
            </dd>
            {management.confirmations.totalSent === 0 && (
              <dd className="text-xs text-slate-600 dark:text-slate-400">Nenhum lembrete enviado no período.</dd>
            )}
          </div>
          <div className="space-y-1 sm:pl-5">
            <dt className="text-sm text-slate-600 dark:text-slate-400">Canal que mais trouxe agendamentos</dt>
            <dd className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">{topChannel ? topChannel.channel : "—"}</dd>
            <dd className="text-xs text-slate-600 dark:text-slate-400">
              {topChannel
                ? `${topChannel.scheduled} agendamento(s) de ${topChannel.conversations} conversa(s)`
                : "Nenhum agendamento com canal identificado no período."}
            </dd>
          </div>
        </dl>
      </section>

      {/* =========================================================================
          ATENDIMENTO / CHAT
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Atendimento</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Total de Conversas
              </span>
              <MessageSquare className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {chatReport.totalConversations}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {chatReport.totalResolved} resolvidas no período
            </p>
            <ReportDelta current={chatReport.totalConversations} previous={prevChat.totalConversations} unit="%" better="up" days={days} />
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                Conversão em Agendamento
              </span>
              <TrendingUp className="w-4 h-4 text-slate-400" />
            </div>
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
              {chatReport.conversionRate}%
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {chatReport.totalAgendados} de {chatReport.totalResolved}{" "}
              resolvidos
            </p>
            <ReportDelta current={chatReport.conversionRate} previous={prevChat.conversionRate} unit="pts" better="up" days={days} />
          </div>

          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
            {/* D3: mediana, só horário de expediente e só conversas com resposta humana. */}
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Tempo de atendimento (mediana, em horário comercial)
            </span>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">1ª resposta</span>
              <span className={`text-sm font-bold tabular-nums ${slaTone(rs.medianFirstResponseMin)}`}>
                {rs.medianFirstResponseMin !== null ? formatDurationHuman(rs.medianFirstResponseMin) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Resolução</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {rs.medianResolutionMin !== null ? formatDurationHuman(rs.medianResolutionMin) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Respondidas em até {SLA_WARNING_MINUTES} min</span>
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100">
                {rs.withinSlaPct !== null ? `${rs.withinSlaPct}%` : "—"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {rs.answered > 0
                ? `${rs.answered} conversa(s) com resposta da equipe${rs.unanswered > 0 ? `; ${rs.unanswered} sem resposta ficaram de fora` : ""}.`
                : "Sem tempos: nenhuma conversa teve resposta da equipe no período."}
            </p>
          </div>
        </div>

        {/* Sentimento: informação secundária — recolhido por padrão. */}
        <details className="group bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
            Sentimento das conversas auditadas
          </summary>
          <SentimentBar
            positivePct={chatReport.sentimentPositivePct}
            neutroPct={chatReport.sentimentNeutroPct}
            negativoPct={chatReport.sentimentNegativoPct}
          />
          <p className="text-[11px] text-slate-400 dark:text-slate-500">
            {chatReport.sentimentAuditedCount} conversa(s) auditada(s) por IA /
            regras automáticas no período.
          </p>
        </details>
      </div>

      {/* =========================================================================
          DESEMPENHO DA EQUIPE
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Desempenho da Equipe
        </h2>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs !p-0 overflow-hidden">
          {management.attendants.length === 0 ? (
            <p className="p-5 text-xs text-slate-500 dark:text-slate-400">
              Nenhuma conversa atribuída no período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="pl-5 text-xs">Atendente</TableHead>
                  <TableHead className="text-right text-xs">
                    Atendimentos
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Tempo médio de 1ª resposta
                  </TableHead>
                  <TableHead className="text-right text-xs">
                    Agendamentos Concluídos
                  </TableHead>
                  <TableHead className="pr-5 text-right text-xs">
                    Conversão
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {management.attendants.map((a) => (
                  <TableRow key={a.userId}>
                    <TableCell className="pl-5 font-medium">
                      <span className="inline-flex items-center gap-2">
                        {a.userName}
                        {a.userId === topAttendantId && (
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            Maior conversão
                          </Badge>
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {a.total}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {a.avgFrtSec !== null ? formatDurationHuman(a.avgFrtSec / 60) : "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {a.scheduled}
                    </TableCell>
                    <TableCell className="pr-5 text-right font-mono font-semibold">
                      {a.conversionRate}%
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </div>

      {/* =========================================================================
          EFICÁCIA DE CONFIRMAÇÕES (NO-SHOW)
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Confirmações dos lembretes</h2>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
          {management.confirmations.totalSent === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Nenhum lembrete com acompanhamento de resposta no período.
            </p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:divide-x divide-slate-200 dark:divide-slate-800">
              {[
                {
                  label: "Confirmados",
                  value: management.confirmations.confirmed,
                  pctValue: management.confirmations.confirmedPct,
                  hint: 'Responderam "Sim" ao lembrete',
                  Icon: CheckCircle2,
                  iconClass: "text-emerald-600",
                },
                {
                  label: "Cancelaram",
                  value: management.confirmations.cancelled,
                  pctValue: management.confirmations.cancelledPct,
                  hint: "Horário liberado para encaixe",
                  Icon: XCircle,
                  iconClass: "text-amber-600",
                },
                {
                  label: "Pediram para remarcar",
                  value: management.confirmations.rescheduled,
                  pctValue: management.confirmations.rescheduledPct,
                  hint: "A recepção precisa remarcar",
                  Icon: RotateCcw,
                  iconClass: "text-sky-600",
                },
                {
                  label: "Sem Retorno",
                  value: management.confirmations.noReply,
                  pctValue: management.confirmations.noReplyPct,
                  hint: "Sem resposta antes da data",
                  Icon: Clock,
                  iconClass: "text-slate-400",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="space-y-1.5 lg:px-4 lg:first:pl-0"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                      {m.label}
                    </span>
                    <m.Icon className={`w-4 h-4 ${m.iconClass}`} />
                  </div>
                  <p className="text-2xl font-semibold font-mono">
                    {m.value}{" "}
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      ({m.pctValue}%)
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {m.hint}
                  </p>
                </div>
              ))}
            </div>
          )}
          {management.confirmations.totalSent > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Base: {management.confirmations.totalSent} lembrete(s) automático(s) enviado(s) no período. Lembretes
              enviados há menos de 1 dia ainda não contam como sem retorno.
            </p>
          )}
        </div>
      </div>

      {/* =========================================================================
          CONVERSÃO POR CANAL DE AQUISIÇÃO
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Conversão por Canal de Aquisição</h2>
        <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs !p-0 overflow-hidden">
          {management.channelConversion.length === 0 ? (
            <p className="p-5 text-xs text-slate-500 dark:text-slate-400">Nenhuma conversa no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                  <TableHead className="pl-5 text-xs">Canal</TableHead>
                  <TableHead className="text-right text-xs">Conversas</TableHead>
                  <TableHead className="text-right text-xs">Agendamentos</TableHead>
                  <TableHead className="text-right text-xs">Conversão</TableHead>
                  <TableHead className="pr-5 text-right text-xs">Receita Estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {management.channelConversion.map((c) => (
                  <TableRow key={c.channel}>
                    <TableCell className="pl-5 font-medium">{c.channel}</TableCell>
                    <TableCell className="text-right font-mono">{c.conversations}</TableCell>
                    <TableCell className="text-right font-mono">{c.scheduled}</TableCell>
                    <TableCell className="text-right font-mono">{c.conversionRate}%</TableCell>
                    <TableCell className="pr-5 text-right font-mono font-semibold">
                      {c.estimatedRevenue !== null ? formatCurrency(c.estimatedRevenue) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
        <p className="text-[11px] text-slate-400 dark:text-slate-500">
          Canal detectado na 1ª mensagem do paciente (anúncio do Meta, UTM ou texto de campanha). “Não identificado” =
          conversas anteriores ao rastreamento ou abertas por lembrete/disparo da clínica.
        </p>
      </div>

      {/* =========================================================================
          CAMPANHAS DE DISPARO — progresso e retorno (em andamento ou do período)
         ========================================================================= */}
      {campaigns.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Campanhas de Disparo</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {campaigns.map((c) => {
              const s = c.stats;
              const progress = s.total > 0 ? Math.round(((s.sent + s.failed + s.optedOut) / s.total) * 100) : 0;
              return (
                <div key={c.id} className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        Criada em {new Date(c.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                        {c.tag && <> · tag <span className="font-medium text-slate-700 dark:text-slate-300">{c.tag}</span></>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline">
                        {c.status === "RUNNING" ? "Enviando" : c.status === "PAUSED" ? "Pausada" : "Concluída"}
                      </Badge>
                      <Megaphone className="w-5 h-5 text-pink-600" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                      <span>{s.sent} de {s.total} enviadas</span>
                      <span>{s.pending} na fila</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do envio">
                      <div className="h-full bg-pink-500" style={{ width: `${progress}%` }} />
                    </div>
                  </div>

                  <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <dt className="text-[11px] text-slate-500 dark:text-slate-400">Responderam</dt>
                      <dd className="text-lg font-semibold font-mono">{s.replied}</dd>
                      <dd className="text-[11px] text-slate-500 dark:text-slate-400">{s.replyRate}% das enviadas</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500 dark:text-slate-400">Agendados</dt>
                      <dd className="text-lg font-semibold font-mono">{s.scheduled}</dd>
                      <dd className="text-[11px] text-slate-500 dark:text-slate-400">etapa Agendado no CRM</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500 dark:text-slate-400">Pediram pra sair</dt>
                      <dd className="text-lg font-semibold font-mono">{s.optedOut}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] text-slate-500 dark:text-slate-400">Falharam</dt>
                      <dd className="text-lg font-semibold font-mono">{s.failed}</dd>
                      <dd className="text-[11px] text-slate-500 dark:text-slate-400">número sem WhatsApp</dd>
                    </div>
                  </dl>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Resposta = mensagem da paciente em até 7 dias depois de receber.
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          DEMANDA POR MÉDICO E PROCEDIMENTO
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Demanda por Médico e Procedimento
        </h2>
        {/* D2: base diferente do "Faturamento Estimado" (que conta conversas finalizadas
            como agendamento) — aqui são agendamentos gravados no Conecta Saúde. */}
        <p className="text-xs text-slate-500 dark:text-slate-400 -mt-2">
          Base: agendamentos registrados no Conecta Saúde (pelo painel ou pela integração com o sistema da clínica) —
          diferente das conversas do WhatsApp finalizadas como agendamento.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Médicos Mais Procurados
            </p>
            <HorizontalBarChart
              data={management.topDoctors.filter((d) => !isProcedureAgenda(d.name)).map((d) => ({
                label: d.name,
                value: d.count,
                colorClass: "bg-sky-500",
              }))}
            />
          </div>
          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Distribuição por Tipo de Atendimento
            </p>
            <HorizontalBarChart
              data={[
                {
                  label: "Consulta Nova",
                  value: management.kindDistribution.CONSULTA,
                  colorClass: "bg-sky-500",
                },
                {
                  label: "Retorno",
                  value: management.kindDistribution.RETORNO,
                  colorClass: "bg-violet-500",
                },
                {
                  label: "Exame/Procedimento",
                  value: management.kindDistribution.EXAME,
                  colorClass: "bg-emerald-500",
                },
              ]}
            />
            {kindTotal > 0 && (
              <p className="text-[11px] text-slate-400 dark:text-slate-500">
                {kindTotal} agendamento(s) registrado(s) no Conecta Saúde no período.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          FLUXO / HORÁRIOS DE PICO
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Fluxo de Mensagens / Horários de Pico
        </h2>
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
          <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
            Mensagens recebidas por faixa horária (08h–18h, horário de Brasília)
          </p>
          <VerticalBarChart
            data={management.hourlyInbound.map((b) => ({
              label: `${String(b.hour).padStart(2, "0")}h`,
              value: b.count,
            }))}
          />
        </div>
      </div>

      {/* =========================================================================
          AGENDAMENTOS — só pra clínicas do marketplace (não exclusivas de WhatsApp)
         ========================================================================= */}
      {appointmentsReport && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Agendamentos
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <ReportSelectFilter
                basePath="/clinic/relatorio"
                paramKey="doctor"
                placeholder="Médico"
                options={[
                  { value: "_all", label: "Todos os médicos" },
                  ...doctorOptions.map((d) => ({ value: d, label: d })),
                ]}
              />
              <ReportSelectFilter
                basePath="/clinic/relatorio"
                paramKey="procedure"
                placeholder="Procedimento"
                options={[
                  { value: "_all", label: "Todos os procedimentos" },
                  ...procedureOptions.map((cp) => ({
                    value: cp.procedureId,
                    label: cp.procedure.name,
                  })),
                ]}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium">
                  Agendamentos no Período
                </span>
                <CalendarCheck className="w-5 h-5 text-sky-600" />
              </div>
              <p className="text-2xl font-semibold font-mono">
                {appointmentsReport.totalAppointments}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {appointmentsReport.countByStatus.COMPLETED} concluídos
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium">
                  Cancelamento / Falta
                </span>
                <XCircle className="w-5 h-5 text-rose-600" />
              </div>
              <p className="text-2xl font-semibold font-mono">
                {appointmentsReport.cancellationRate}%
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {appointmentsReport.countByStatus.CANCELLED} cancelados,{" "}
                {appointmentsReport.countByStatus.NO_SHOW} faltas
              </p>
            </div>

            <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-2">
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
                <span className="text-xs font-medium">Receita do Período</span>
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <p className="text-2xl font-semibold font-mono">
                {formatCurrency(appointmentsReport.revenue)}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Consultas concluídas
              </p>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Procedimentos Mais Agendados
            </p>
            <HorizontalBarChart
              data={appointmentsReport.topProcedures.map((p) => ({
                label: p.name,
                value: p.count,
                colorClass: "bg-sky-500",
              }))}
            />
          </div>

          <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-5 shadow-xs space-y-3">
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Agendamentos por Status
            </p>
            <HorizontalBarChart
              data={(
                Object.keys(
                  appointmentsReport.countByStatus,
                ) as (keyof typeof appointmentsReport.countByStatus)[]
              ).map((status) => ({
                label: appointmentStatusLabels[status],
                value: appointmentsReport.countByStatus[status],
                colorClass: STATUS_COLOR_CLASS[status],
              }))}
            />
          </div>
        </div>
      )}
      {/* =========================================================================
          VALORES ESTIMADOS — por último e marcados como estimativa (crítica de Relatórios:
          estimativas apareciam no topo com peso de fato)
         ========================================================================= */}
      <div className="space-y-4">
        <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
          Valores estimados
          <span className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-px text-xs font-semibold text-amber-800 dark:text-amber-300">
            Estimativa
          </span>
        </h2>
        <p className="-mt-2 text-xs text-slate-600 dark:text-slate-400">
          Calculados com o ticket médio de consulta — não são valores recebidos.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Faturamento estimado</span>
              <Wallet className="w-4 h-4 text-slate-400" aria-hidden />
            </div>
            <p className="text-2xl font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {management.estimatedRevenue !== null ? formatCurrency(management.estimatedRevenue) : "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {management.scheduledCount} conversa(s) do WhatsApp finalizadas como agendamento
              {management.ticket !== null ? ` × ticket médio de ${formatCurrency(management.ticket)}` : " — sem ticket médio cadastrado"}
            </p>
          </div>
          <div className="bg-white dark:bg-slate-900 p-5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Valor das consultas confirmadas</span>
              <ShieldCheck className="w-4 h-4 text-slate-400" aria-hidden />
            </div>
            <p className="text-2xl font-semibold tabular-nums text-slate-700 dark:text-slate-200">
              {management.protectedRevenue !== null ? formatCurrency(management.protectedRevenue) : "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {management.confirmations.confirmed} consulta(s) confirmada(s) pelos lembretes automáticos
              {management.ticket !== null ? ` × ticket médio de ${formatCurrency(management.ticket)}` : " — sem ticket médio cadastrado"}
            </p>
          </div>
        </div>
        {management.ticket === null && (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {/* "Preços e Horários" não aparece no menu de clínicas com WhatsApp exclusivo —
                não mandar pra uma tela que o perfil não enxerga. */}
            {isExclusive ? (
              "Para estimar valores, peça à equipe do Conecta Saúde para cadastrar o ticket médio de consulta da clínica."
            ) : (
              <>
                Para estimar valores, informe o ticket médio de consulta em{" "}
                <Link href="/clinic/precos" className="font-medium text-sky-700 dark:text-sky-400 underline underline-offset-2">
                  Preços e Horários
                </Link>
                .
              </>
            )}
          </p>
        )}
      </div>

    </div>
  );
}
