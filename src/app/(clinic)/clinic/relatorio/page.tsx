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
  getClinicCampaignBreakdown,
} from "@/actions/clinic";
import { CampaignBreakdownTable } from "@/components/clinic/campaign-breakdown-table";
import Link from "next/link";
import { isProcedureAgenda } from "@/lib/doctor-names";
import { formatDurationHuman, SLA_CRITICAL_MINUTES, SLA_WARNING_MINUTES } from "@/lib/sla-calculator";
import { ReportDelta } from "@/components/clinic/report-delta";
import {
  UNIDENTIFIED_CHANNEL,
  MIN_ATTENDANT_VOLUME,
  topConverter,
  type OutcomeGroup,
} from "@/lib/report-metrics";
import { parsePeriodKey, periodLabels, periodWindow } from "@/lib/report-period";
import { formatCurrency, appointmentStatusLabels } from "@/lib/format";
import {
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  ShieldCheck,
  Wallet,
  X,
  ChevronRight,
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

/** Cor da barra por grupo de desfecho ("Por que as conversas terminaram"). */
const OUTCOME_COLOR: Record<OutcomeGroup, string> = {
  agendou: "bg-emerald-500",
  perdido: "bg-rose-500",
  outro: "bg-sky-500",
  sem_desfecho: "bg-slate-400",
};

/** Percentual no formato brasileiro (64,1%). */
const pctBR = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

const BASE = "/clinic/relatorio";
const card = "bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RelatorioPageProps = {
  searchParams: Promise<{
    periodo?: string;
    days?: string;
    tag?: string;
    doctor?: string;
    procedure?: string;
    channel?: string;
  }>;
};

/** Título de bloco (Resultado / Equipe e operação / Origem dos pacientes). */
function BlockHeading({ id, title, hint }: { id: string; title: string; hint: string }) {
  return (
    <div className="border-b border-slate-200 dark:border-slate-800 pb-2">
      <h2 id={id} className="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      <p className="text-xs text-slate-600 dark:text-slate-400">{hint}</p>
    </div>
  );
}

/** Aviso nas seções que não mudam com os filtros de tag/canal (só aparece com filtro ativo). */
function NotFiltered({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-xs text-amber-800 dark:text-amber-300">Esta seção não muda com os filtros de tag e canal.</p>;
}

export default async function ClinicReportPage({
  searchParams,
}: RelatorioPageProps) {
  const params = await searchParams;
  const period = parsePeriodKey(params.periodo, params.days);
  const labels = periodLabels(period);
  const tags = params.tag ? [params.tag] : undefined;

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
    campaignBreakdown,
  ] = await Promise.all([
    getClinicChatReport(period, tags, params.channel),
    isExclusive
      ? Promise.resolve(null)
      : getClinicAppointmentsReport(period, params.doctor, params.procedure),
    getDistinctConversationTags(period),
    isExclusive ? Promise.resolve([]) : getDistinctDoctorNames(),
    isExclusive ? Promise.resolve([]) : listClinicProcedures(),
    getClinicManagementReport(period, params.channel),
    getDistinctAcquisitionChannels(period),
    getClinicCampaignReport(period),
    // Janela de comparação ("↑ 8 pts vs setembro").
    getClinicChatReport(period, tags, params.channel, true),
    getClinicManagementReport(period, params.channel, true),
    getClinicCampaignBreakdown(period),
  ]);
  const rs = chatReport.responseStats;
  const prevRs = prevChat.responseStats;
  const outcomes = chatReport.outcomes;
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
  const topAttendantId = topConverter(management.attendants);
  const kindTotal =
    management.kindDistribution.CONSULTA +
    management.kindDistribution.RETORNO +
    management.kindDistribution.EXAME;

  // Filtros ativos — visíveis na página (antes só iam pro CSV) e removíveis um a um.
  const procedureName = params.procedure
    ? procedureOptions.find((cp) => cp.procedureId === params.procedure)?.procedure.name ?? params.procedure
    : null;
  const activeFilters = [
    params.tag ? { key: "tag", label: `Tag: ${params.tag}` } : null,
    params.channel ? { key: "channel", label: `Canal: ${params.channel}` } : null,
    params.doctor ? { key: "doctor", label: `Médico: ${params.doctor}` } : null,
    procedureName ? { key: "procedure", label: `Procedimento: ${procedureName}` } : null,
  ].filter((f): f is { key: string; label: string } => f !== null);
  const conversationFiltered = Boolean(params.tag || params.channel);
  const urlWithout = (key: string) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== key && k !== "days") next.set(k, v);
    next.set("periodo", period);
    return `${BASE}?${next.toString()}`;
  };

  const win = periodWindow(period, false);
  const fmtDate = (d: Date) => d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const windowEnd = win.until ? new Date(win.until.getTime() - 1) : new Date();
  const csvPeriodLabel = `${labels.title} (${fmtDate(win.since)} a ${fmtDate(windowEnd)})`;

  return (
    <div className="space-y-10 font-sans flex-1 overflow-y-auto text-slate-900 dark:text-slate-100 p-6 md:p-8 max-w-7xl mx-auto w-full">
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <PageHeader
            title="Relatórios"
            subtitle={`${chatReport.totalConversations} conversa(s) · ${labels.title} · ${clinic.tradeName}`}
          />
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <ReportSelectFilter
              basePath={BASE}
              paramKey="tag"
              placeholder="Tag"
              options={[
                { value: "_all", label: "Todas as tags" },
                ...tagOptions.map((t) => ({ value: t, label: t })),
              ]}
            />
            <ReportSelectFilter
              basePath={BASE}
              paramKey="channel"
              placeholder="Canal"
              options={[
                { value: "_all", label: "Todos os canais" },
                ...channelOptions.map((c) => ({ value: c, label: c })),
              ]}
            />
            <PeriodFilter basePath={BASE} />
            <ReportExportButton
              clinic={clinic.tradeName}
              periodKey={period}
              periodLabel={csvPeriodLabel}
              filters={activeFilters.map((f) => f.label)}
              rows={[
                ["Conversas no período", chatReport.totalConversations],
                ["Conversas resolvidas", chatReport.totalResolved],
                ["Conversas com desfecho (base da conversão)", outcomes.withOutcome],
                ["Encerradas sem desfecho (inatividade/sem resposta)", outcomes.noOutcome],
                ["Conversão em agendamento (%)", chatReport.conversionRate ?? "—"],
                ["Pacientes perdidos", outcomes.lostTotal],
                ...outcomes.rows.map((o) => [`Desfecho: ${o.label}`, o.count] as [string, string | number]),
                ["Mediana de 1ª resposta (min, horário comercial)", rs.medianFirstResponseMin ?? "—"],
                ["Mediana de resolução (min, horário comercial)", rs.medianResolutionMin ?? "—"],
                [`Respondidas em até ${SLA_WARNING_MINUTES} min (%)`, rs.withinSlaPct ?? "—"],
                ["Sentimento positivo (%)", chatReport.sentimentPositivePct],
                ["Sentimento neutro (%)", chatReport.sentimentNeutroPct],
                ["Sentimento negativo (%)", chatReport.sentimentNegativoPct],
                ...management.attendants.flatMap(
                  (a) =>
                    [
                      [`Atendente ${a.userName}: atendimentos`, a.total],
                      [`Atendente ${a.userName}: agendaram`, a.scheduled],
                      [`Atendente ${a.userName}: conversão (%)`, a.conversionRate ?? "—"],
                      [`Atendente ${a.userName}: mediana 1ª resposta (min)`, a.medianFrtSec !== null ? Math.round(a.medianFrtSec / 60) : "—"],
                    ] as [string, string | number][],
                ),
                ["Lembretes enviados", management.confirmations.totalSent],
                ["Confirmaram (%)", management.confirmations.confirmedPct],
                ["Cancelaram (%)", management.confirmations.cancelledPct],
                ["Pediram para remarcar (%)", management.confirmations.rescheduledPct],
                ["Sem resposta ao lembrete (%)", management.confirmations.noReplyPct],
                ["Faturamento estimado (R$) — estimativa", management.estimatedRevenue ?? "—"],
                ["Valor das consultas confirmadas (R$) — estimativa", management.protectedRevenue ?? "—"],
                ...management.channelConversion.map(
                  (c) => [`Agendamentos via ${c.channel}`, c.scheduled] as [string, string | number],
                ),
                ...campaigns.flatMap(
                  (c) =>
                    [
                      [`Campanha ${c.name}: enviadas`, c.stats.sent],
                      [`Campanha ${c.name}: responderam`, c.stats.replied],
                      [`Campanha ${c.name}: agendados`, c.stats.scheduled],
                    ] as [string, string | number][],
                ),
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
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-xs" aria-label="Filtros ativos">
            <span className="font-medium text-slate-600 dark:text-slate-400">Filtrando:</span>
            {activeFilters.map((f) => (
              <Link
                key={f.key}
                href={urlWithout(f.key)}
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800 px-2 py-1 font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
                aria-label={`Remover filtro ${f.label}`}
              >
                {f.label}
                <X className="w-3 h-3" aria-hidden />
              </Link>
            ))}
            <Link href={`${BASE}?periodo=${period}`} className="font-medium text-sky-700 dark:text-sky-400 underline underline-offset-2">
              Limpar filtros
            </Link>
          </div>
        )}
      </div>

      {/* =========================================================================
          RESUMO DO PERÍODO — as 3 perguntas do gestor, com comparação
         ========================================================================= */}
      <section aria-labelledby="resumo-titulo" className={`${card} p-5`}>
        <h2 id="resumo-titulo" className="text-base font-semibold text-slate-900 dark:text-slate-100">
          Resumo — {labels.title}
        </h2>
        <dl className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-5 sm:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="space-y-1 sm:pr-5">
            <dt className="text-sm text-slate-600 dark:text-slate-400">Conversão em agendamento</dt>
            <dd className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {chatReport.conversionRate !== null ? pctBR(chatReport.conversionRate) : "—"}
            </dd>
            <dd>
              <ReportDelta current={chatReport.conversionRate} previous={prevChat.conversionRate} unit="pts" better="up" compareLabel={labels.compare} />
            </dd>
            <dd className="text-xs text-slate-600 dark:text-slate-400">
              {outcomes.withOutcome > 0
                ? `${chatReport.totalAgendados} de ${outcomes.withOutcome} conversa(s) com desfecho`
                : "Nenhuma conversa com desfecho no período."}
            </dd>
          </div>
          <div className="space-y-1 sm:px-5">
            <dt className="text-sm text-slate-600 dark:text-slate-400">Respondidas em até {SLA_WARNING_MINUTES} min</dt>
            <dd className={`text-3xl font-bold tabular-nums ${rs.withinSlaPct === null ? "text-slate-900 dark:text-slate-100" : rs.withinSlaPct >= 80 ? "text-emerald-700 dark:text-emerald-400" : rs.withinSlaPct >= 50 ? "text-amber-700 dark:text-amber-400" : "text-rose-700 dark:text-rose-400"}`}>
              {rs.withinSlaPct !== null ? pctBR(rs.withinSlaPct) : "—"}
            </dd>
            <dd>
              <ReportDelta current={rs.withinSlaPct} previous={prevRs.withinSlaPct} unit="pts" better="up" compareLabel={labels.compare} />
            </dd>
            <dd className="text-xs text-slate-600 dark:text-slate-400">
              {rs.withinSlaPct === null
                ? "Nenhuma conversa respondida pela equipe no período."
                : rs.withinSlaPct >= 80
                  ? "Meta atingida (80% ou mais)."
                  : rs.withinSlaPct >= 50
                    ? "Abaixo da meta de 80%."
                    : "Bem abaixo da meta de 80%."}
            </dd>
          </div>
          <div className="space-y-1 sm:pl-5">
            <dt className="text-sm text-slate-600 dark:text-slate-400">Pacientes que confirmaram o lembrete</dt>
            <dd className="text-3xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
              {management.confirmations.totalSent > 0 ? pctBR(management.confirmations.confirmedPct) : "—"}
            </dd>
            <dd>
              <ReportDelta
                current={management.confirmations.totalSent > 0 ? management.confirmations.confirmedPct : null}
                previous={prevManagement.confirmations.totalSent > 0 ? prevManagement.confirmations.confirmedPct : null}
                unit="pts"
                better="up"
                compareLabel={labels.compare}
              />
            </dd>
            {management.confirmations.totalSent === 0 && (
              <dd className="text-xs text-slate-600 dark:text-slate-400">Nenhum lembrete enviado no período.</dd>
            )}
          </div>
        </dl>
      </section>

      {/* =========================================================================
          BLOCO 1 — RESULTADO
         ========================================================================= */}
      <section aria-labelledby="bloco-resultado" className="space-y-6">
        <BlockHeading id="bloco-resultado" title="Resultado" hint="Quantos pacientes agendaram, quantos perdemos e por quê." />

        {/* Por que as conversas terminaram — motivos de finalização, cada um abre a lista. */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Por que as conversas terminaram</h3>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              <span className="font-semibold tabular-nums">{outcomes.lostTotal}</span> paciente(s) perdido(s)
              {outcomes.topLossReason && <> · principal motivo: <span className="font-semibold">{outcomes.topLossReason.label.replace("Perdido — ", "")}</span></>}
              {" "}
              <ReportDelta current={outcomes.lostTotal} previous={prevChat.outcomes.lostTotal} unit="%" better="down" compareLabel={labels.compare} />
            </p>
          </div>
          <div className={`${card} p-5 space-y-3`}>
            {outcomes.rows.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">Nenhuma conversa finalizada no período.</p>
            ) : (
              <ul className="space-y-1">
                {outcomes.rows.map((o) => {
                  const max = Math.max(...outcomes.rows.map((r) => r.count));
                  return (
                    <li key={o.reason}>
                      <Link
                        href={`/clinic/contatos?motivo=${encodeURIComponent(o.reason)}`}
                        className="group flex items-center gap-3 rounded-md px-2 py-1.5 -mx-2 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <span className="w-40 sm:w-56 shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">{o.label}</span>
                        <span className="flex-1 h-4 flex items-center" aria-hidden>
                          <span className={`h-4 rounded-r-[4px] ${OUTCOME_COLOR[o.group]}`} style={{ width: `${Math.max(2, (o.count / max) * 100)}%` }} />
                        </span>
                        <span className="w-24 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                          <span className="sr-only">: </span>
                          {o.count} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">({pctBR(o.pct)})</span>
                        </span>
                        <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Base: {outcomes.resolved} conversa(s) finalizada(s) de {chatReport.totalConversations}. A conversão conta só as{" "}
              {outcomes.withOutcome} com desfecho — {outcomes.noOutcome} encerrada(s) por inatividade ou sem resposta ficam fora,
              para o fechamento automático não derrubar a taxa. Clique num motivo para ver as conversas.
            </p>
          </div>
        </div>

        {/* Confirmações dos lembretes */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Confirmações dos lembretes</h3>
          <NotFiltered show={conversationFiltered} />
          <div className={`${card} p-5 space-y-4`}>
            {management.confirmations.totalSent === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum lembrete com acompanhamento de resposta no período.
              </p>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:divide-x divide-slate-200 dark:divide-slate-800">
                {[
                  { label: "Confirmaram", value: management.confirmations.confirmed, pctValue: management.confirmations.confirmedPct, hint: 'Responderam "Sim" ao lembrete', Icon: CheckCircle2, iconClass: "text-emerald-600" },
                  { label: "Cancelaram", value: management.confirmations.cancelled, pctValue: management.confirmations.cancelledPct, hint: "Horário liberado para encaixe", Icon: XCircle, iconClass: "text-amber-600" },
                  { label: "Pediram para remarcar", value: management.confirmations.rescheduled, pctValue: management.confirmations.rescheduledPct, hint: "A recepção precisa remarcar", Icon: RotateCcw, iconClass: "text-sky-600" },
                  { label: "Não responderam o lembrete", value: management.confirmations.noReply, pctValue: management.confirmations.noReplyPct, hint: "Sem resposta antes da data da consulta", Icon: Clock, iconClass: "text-slate-400" },
                ].map((m) => (
                  <div key={m.label} className="space-y-1.5 lg:px-4 lg:first:pl-0">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{m.label}</span>
                      <m.Icon className={`w-4 h-4 ${m.iconClass}`} aria-hidden />
                    </div>
                    <p className="text-2xl font-semibold tabular-nums">
                      {m.value}{" "}
                      <span className="text-sm text-slate-500 dark:text-slate-400">({pctBR(m.pctValue)})</span>
                    </p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">{m.hint}</p>
                  </div>
                ))}
              </div>
            )}
            {management.confirmations.totalSent > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Base: {management.confirmations.totalSent} lembrete(s) automático(s) enviado(s) no período. Lembretes
                enviados há menos de 1 dia ainda não contam como sem resposta.
              </p>
            )}
          </div>
        </div>

        {/* AGENDAMENTOS — só pra clínicas do marketplace (não exclusivas de WhatsApp) */}
        {appointmentsReport && (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Agendamentos</h3>
              <div className="flex flex-wrap items-center gap-2">
                <ReportSelectFilter
                  basePath={BASE}
                  paramKey="doctor"
                  placeholder="Médico"
                  options={[{ value: "_all", label: "Todos os médicos" }, ...doctorOptions.map((d) => ({ value: d, label: d }))]}
                />
                <ReportSelectFilter
                  basePath={BASE}
                  paramKey="procedure"
                  placeholder="Procedimento"
                  options={[
                    { value: "_all", label: "Todos os procedimentos" },
                    ...procedureOptions.map((cp) => ({ value: cp.procedureId, label: cp.procedure.name })),
                  ]}
                />
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Médico e procedimento filtram só esta seção.{params.channel ? " O filtro de canal não se aplica aqui." : ""}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className={`${card} p-5 space-y-1.5`}>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Agendamentos no período</span>
                <p className="text-2xl font-semibold tabular-nums">{appointmentsReport.totalAppointments}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">{appointmentsReport.countByStatus.COMPLETED} realizados</p>
              </div>
              <div className={`${card} p-5 space-y-1.5`}>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Cancelamento ou falta</span>
                <p className="text-2xl font-semibold tabular-nums">{pctBR(appointmentsReport.cancellationRate)}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {appointmentsReport.countByStatus.CANCELLED} cancelados, {appointmentsReport.countByStatus.NO_SHOW} faltas
                </p>
              </div>
              <div className={`${card} p-5 space-y-1.5`}>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Receita do período</span>
                <p className="text-2xl font-semibold tabular-nums">{formatCurrency(appointmentsReport.revenue)}</p>
                <p className="text-xs text-slate-600 dark:text-slate-400">Consultas realizadas</p>
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className={`${card} p-5 space-y-3`}>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Procedimentos mais agendados</p>
                <HorizontalBarChart data={appointmentsReport.topProcedures.map((p) => ({ label: p.name, value: p.count, colorClass: "bg-sky-500" }))} />
              </div>
              <div className={`${card} p-5 space-y-3`}>
                <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Agendamentos por status</p>
                <HorizontalBarChart
                  data={(Object.keys(appointmentsReport.countByStatus) as (keyof typeof appointmentsReport.countByStatus)[]).map((status) => ({
                    label: appointmentStatusLabels[status],
                    value: appointmentsReport.countByStatus[status],
                    colorClass: STATUS_COLOR_CLASS[status],
                  }))}
                />
              </div>
            </div>
          </div>
        )}

        {/* VALORES ESTIMADOS — marcados como estimativa */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            Valores estimados
            <span className="rounded-md border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-px text-xs font-semibold text-amber-800 dark:text-amber-300">
              Estimativa
            </span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">Calculados com o ticket médio de consulta — não são valores recebidos.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className={`${card} p-5 space-y-1.5`}>
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
            <div className={`${card} p-5 space-y-1.5`}>
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
      </section>

      {/* =========================================================================
          BLOCO 2 — EQUIPE E OPERAÇÃO
         ========================================================================= */}
      <section aria-labelledby="bloco-equipe" className="space-y-6">
        <BlockHeading id="bloco-equipe" title="Equipe e operação" hint="Velocidade de resposta, quem atendeu e quando os pacientes escrevem." />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className={`${card} p-5 space-y-2`}>
            {/* D3: mediana, só horário de expediente e só conversas com resposta humana. */}
            <h3 className="text-xs font-medium text-slate-600 dark:text-slate-400">Tempo de atendimento (mediana, horário comercial)</h3>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">1ª resposta</span>
              <span className={`text-sm font-bold tabular-nums ${slaTone(rs.medianFirstResponseMin)}`}>
                {rs.medianFirstResponseMin !== null ? formatDurationHuman(rs.medianFirstResponseMin) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">Resolução</span>
              <span className="text-sm font-bold tabular-nums text-slate-900 dark:text-slate-100">
                {rs.medianResolutionMin !== null ? formatDurationHuman(rs.medianResolutionMin) : "—"}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {rs.answered > 0
                ? `${rs.answered} conversa(s) com resposta da equipe${rs.unanswered > 0 ? `; ${rs.unanswered} sem resposta ficaram de fora` : ""}.`
                : "Sem tempos: nenhuma conversa teve resposta da equipe no período."}
            </p>
          </div>

          <div className={`${card} lg:col-span-2 overflow-hidden`}>
            <h3 className="px-5 pt-4 pb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">Desempenho da equipe</h3>
            {management.attendants.length === 0 ? (
              <p className="px-5 pb-5 text-xs text-slate-500 dark:text-slate-400">Nenhuma conversa atribuída no período.</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                      <TableHead className="pl-5 text-xs">Atendente</TableHead>
                      <TableHead className="text-right text-xs">Atendimentos</TableHead>
                      <TableHead className="text-right text-xs">1ª resposta (mediana)</TableHead>
                      <TableHead className="text-right text-xs">Agendaram</TableHead>
                      <TableHead className="pr-5 text-right text-xs">Conversão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {management.attendants.map((a) => (
                      <TableRow key={a.userId}>
                        <TableCell className="pl-5 font-medium">
                          <span className="inline-flex items-center gap-2">
                            <Link href={`/clinic/contatos?atendente=${a.userId}`} className="hover:underline underline-offset-2">
                              {a.userName}
                            </Link>
                            {a.userId === topAttendantId && (
                              <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                                Maior conversão
                              </Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{a.total}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {a.medianFrtSec !== null ? formatDurationHuman(a.medianFrtSec / 60) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{a.scheduled}</TableCell>
                        <TableCell className="pr-5 text-right tabular-nums font-semibold">
                          {a.conversionRate !== null ? pctBR(a.conversionRate) : "—"}
                          <span className="block text-xs font-normal text-slate-500 dark:text-slate-400">de {a.withOutcome}</span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <p className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400">
                  Conversão sobre as conversas com desfecho de cada atendente. O selo “Maior conversão” exige ao menos{" "}
                  {MIN_ATTENDANT_VOLUME} conversas com desfecho. Clique no nome para ver as conversas.
                </p>
              </>
            )}
          </div>
        </div>

        <details className={`group ${card} p-5 space-y-3`}>
          <summary className="cursor-pointer text-sm font-medium text-slate-700 dark:text-slate-300">
            Sentimento das conversas auditadas
          </summary>
          <SentimentBar
            positivePct={chatReport.sentimentPositivePct}
            neutroPct={chatReport.sentimentNeutroPct}
            negativoPct={chatReport.sentimentNegativoPct}
          />
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {chatReport.sentimentAuditedCount} conversa(s) auditada(s) por IA / regras automáticas no período.
          </p>
        </details>

        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Horários de pico</h3>
          <NotFiltered show={conversationFiltered} />
          <div className={`${card} p-5 space-y-3`}>
            <p className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Mensagens recebidas por faixa horária (08h–18h, horário de Brasília)
            </p>
            <VerticalBarChart data={management.hourlyInbound.map((b) => ({ label: `${String(b.hour).padStart(2, "0")}h`, value: b.count }))} />
          </div>
        </div>
      </section>

      {/* =========================================================================
          BLOCO 3 — ORIGEM DOS PACIENTES
         ========================================================================= */}
      <section aria-labelledby="bloco-origem" className="space-y-6">
        <BlockHeading id="bloco-origem" title="Origem dos pacientes" hint="De onde vêm os pacientes que agendam e o que eles procuram." />

        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Conversão por canal de aquisição</h3>
            {topChannel && (
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Mais agendamentos: <span className="font-semibold">{topChannel.channel}</span> ({topChannel.scheduled})
              </p>
            )}
          </div>
          <div className={`${card} overflow-hidden`}>
            {management.channelConversion.length === 0 ? (
              <p className="p-5 text-xs text-slate-500 dark:text-slate-400">Nenhuma conversa no período.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50 dark:bg-slate-800/50">
                    <TableHead className="pl-5 text-xs">Canal</TableHead>
                    <TableHead className="text-right text-xs">Conversas</TableHead>
                    <TableHead className="text-right text-xs">Agendaram</TableHead>
                    <TableHead className="text-right text-xs">Conversão</TableHead>
                    <TableHead className="pr-5 text-right text-xs">Receita estimada</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {management.channelConversion.map((c) => (
                    <TableRow key={c.channel}>
                      <TableCell className="pl-5 font-medium">{c.channel}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.conversations}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.scheduled}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.conversionRate !== null ? pctBR(c.conversionRate) : "—"}</TableCell>
                      <TableCell className="pr-5 text-right tabular-nums font-semibold">
                        {c.estimatedRevenue !== null ? formatCurrency(c.estimatedRevenue) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Canal detectado na 1ª mensagem do paciente (anúncio do Meta, UTM ou texto de campanha). “Não identificado” =
            conversas anteriores ao rastreamento ou abertas por lembrete/disparo da clínica. Mostra todos os canais, mesmo
            com o filtro de canal ativo.
          </p>
        </div>

        {/* POR CAMPANHA — canal + campanha da 1ª mensagem (anúncio, utm, #site-…) */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Por campanha</h3>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Campanha = canal + nome do anúncio, utm_campaign ou código do link (ex.: #site-vasectomia — gere os links em
            Configurações › Links). {campaignBreakdown.month
              ? "Informe quanto foi investido no mês para ver custo por lead, por agendamento e retorno."
              : "Escolha \"Este mês\" ou \"Mês passado\" para informar o investimento e ver custo e retorno."}
          </p>
          <div className={`${card} overflow-hidden`}>
            <CampaignBreakdownTable rows={campaignBreakdown.rows} month={campaignBreakdown.month} />
          </div>
        </div>

        {/* CAMPANHAS DE DISPARO — progresso e retorno (em andamento ou do período) */}
        {campaigns.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Campanhas de disparo</h3>
            <NotFiltered show={conversationFiltered} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {campaigns.map((c) => {
                const s = c.stats;
                const progress = s.total > 0 ? Math.round(((s.sent + s.failed + s.optedOut) / s.total) * 100) : 0;
                return (
                  <div key={c.id} className={`${card} p-5 space-y-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-sm truncate">{c.name}</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">
                          Criada em {new Date(c.createdAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                          {c.tag && <> · tag <span className="font-medium text-slate-700 dark:text-slate-300">{c.tag}</span></>}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {c.status === "RUNNING" ? "Enviando" : c.status === "PAUSED" ? "Pausada" : "Concluída"}
                      </Badge>
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                        <span>{s.sent} de {s.total} enviadas</span>
                        <span>{s.pending} na fila</span>
                      </div>
                      <div className="h-2 rounded-[4px] bg-slate-100 dark:bg-slate-800 overflow-hidden" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100} aria-label={`Progresso do envio de ${c.name}`}>
                        <div className="h-full bg-emerald-600" style={{ width: `${progress}%` }} />
                      </div>
                    </div>

                    <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-400">Responderam</dt>
                        <dd className="text-lg font-semibold tabular-nums">{s.replied}</dd>
                        <dd className="text-xs text-slate-600 dark:text-slate-400">{pctBR(s.replyRate)} das enviadas</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-400">Agendados</dt>
                        <dd className="text-lg font-semibold tabular-nums">{s.scheduled}</dd>
                        <dd className="text-xs text-slate-600 dark:text-slate-400">etapa Agendado no CRM</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-400">Pediram para sair</dt>
                        <dd className="text-lg font-semibold tabular-nums">{s.optedOut}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-slate-600 dark:text-slate-400">Não entregues</dt>
                        <dd className="text-lg font-semibold tabular-nums">{s.failed}</dd>
                        <dd className="text-xs text-slate-600 dark:text-slate-400">ex.: número sem WhatsApp</dd>
                      </div>
                    </dl>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Resposta = mensagem da paciente em até 7 dias depois de receber.
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* DEMANDA POR MÉDICO E PROCEDIMENTO */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Demanda por médico e tipo de atendimento</h3>
          {/* D2: base diferente do "Faturamento estimado" (que conta conversas finalizadas
              como agendamento) — aqui são agendamentos gravados no Conecta Saúde. */}
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Base: agendamentos registrados no Conecta Saúde (pelo painel ou pela integração com o sistema da clínica) —
            diferente das conversas do WhatsApp finalizadas como agendamento.
          </p>
          <NotFiltered show={conversationFiltered} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className={`${card} p-5 space-y-3`}>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Médicos mais procurados</p>
              <HorizontalBarChart
                data={management.topDoctors.filter((d) => !isProcedureAgenda(d.name)).map((d) => ({ label: d.name, value: d.count, colorClass: "bg-sky-500" }))}
              />
            </div>
            <div className={`${card} p-5 space-y-3`}>
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Tipo de atendimento</p>
              <HorizontalBarChart
                data={[
                  { label: "Consulta nova", value: management.kindDistribution.CONSULTA, colorClass: "bg-sky-500" },
                  { label: "Retorno", value: management.kindDistribution.RETORNO, colorClass: "bg-violet-500" },
                  { label: "Exame/procedimento", value: management.kindDistribution.EXAME, colorClass: "bg-emerald-500" },
                ]}
              />
              {kindTotal > 0 && (
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  {kindTotal} agendamento(s) registrado(s) no Conecta Saúde no período.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
