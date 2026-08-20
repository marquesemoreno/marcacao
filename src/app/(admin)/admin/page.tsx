import Link from "next/link";
import { Building2, CalendarCheck, Target, Users, ArrowUpRight, Plus, TrendingUp, MessageSquare, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getKpis, listClinics } from "@/actions/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [kpis, clinics] = await Promise.all([getKpis(), listClinics()]);
  const activeClinics = clinics.filter((clinic) => clinic.active).length;

  const maxProcedureCount = Math.max(...kpis.topProcedures.map((p) => p.count), 1);

  return (
    <div className="space-y-8 bg-slate-50/60 dark:bg-slate-950/60 p-4 sm:p-6 flex-1 overflow-y-auto font-sans">
      {/* Header com Título e Ações Rápidas */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 dark:border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
            Painel Geral de Controle Master
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1 font-medium">
            Monitoramento de clínicas credenciadas, agendamentos e rede de marcadores parceiros.
          </p>
        </div>

        {/* Barra de Ações Rápidas */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            render={<Link href="/admin/clinicas" />}
            nativeButton={false}
            size="sm"
            className="h-10 bg-teal-600 hover:bg-teal-700 dark:bg-teal-600 dark:hover:bg-teal-500 text-white font-bold rounded-xl shadow-2xs text-xs px-4"
          >
            <Plus className="size-4 mr-1" />
            Nova Clínica
          </Button>

          <Button
            render={<Link href="/admin/leads" />}
            nativeButton={false}
            size="sm"
            variant="outline"
            className="h-10 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs px-3 hover:bg-white dark:hover:bg-slate-800"
          >
            <Briefcase className="size-3.5 mr-1 text-sky-600 dark:text-sky-400" />
            Leads B2B
          </Button>

          <Button
            render={<Link href="/admin/afiliados" />}
            nativeButton={false}
            size="sm"
            variant="outline"
            className="h-10 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 font-bold rounded-xl text-xs px-3 hover:bg-white dark:hover:bg-slate-800"
          >
            <Users className="size-3.5 mr-1 text-amber-600 dark:text-amber-400" />
            Marcadores
          </Button>

          <Button
            render={<Link href="/admin/inbox" />}
            nativeButton={false}
            size="sm"
            variant="outline"
            className="h-10 border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold rounded-xl text-xs px-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/60"
          >
            <MessageSquare className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
            Abrir Chat
          </Button>
        </div>
      </div>

      {/* 4 Cards de Indicadores (KPIs) Modernos */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Clínicas Credenciadas */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 shadow-2xs">
              <Building2 className="size-6" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-[11px] font-bold text-sky-700 dark:text-sky-300 font-mono border border-sky-100 dark:border-sky-900">
              ✓ Rede Ativa
            </span>
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Clínicas Credenciadas
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {activeClinics}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            Total de unidades parceiras cadastradas
          </p>
        </div>

        {/* Card 2: Total de Agendamentos */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 shadow-2xs">
              <CalendarCheck className="size-6" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-300 font-mono border border-emerald-100 dark:border-emerald-900">
              <ArrowUpRight className="size-3 text-emerald-600 dark:text-emerald-400" />
              Em crescimento
            </span>
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Total de Agendamentos
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {kpis.totalOrders}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            Consultas e exames solicitados
          </p>
        </div>

        {/* Card 3: Taxa de Conversão */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-purple-50 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400 shadow-2xs">
              <Target className="size-6" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 dark:bg-purple-950/60 px-2.5 py-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 font-mono border border-purple-100 dark:border-purple-900">
              Meta 70%+
            </span>
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Taxa de Conversão
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {kpis.conversionRate.toFixed(1)}%
            </p>

            {/* Visual Progress Bar */}
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-purple-500 to-teal-500 transition-all duration-500"
                style={{ width: `${Math.min(kpis.conversionRate, 100)}%` }}
              />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            Agendamentos confirmados ÷ pedidos
          </p>
        </div>

        {/* Card 4: Marcadores / Afiliados */}
        <div className="flex flex-col justify-between rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shadow-2xs">
              <Users className="size-6" />
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-300 font-mono border border-amber-100 dark:border-amber-900">
              ✓ Parceiros
            </span>
          </div>

          <div className="mt-5 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 font-mono">
              Marcadores / Afiliados
            </p>
            <p className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100">
              {kpis.totalAffiliates}
            </p>
          </div>
          <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 font-medium border-t border-slate-100 dark:border-slate-800/80 pt-2.5">
            Agentes promotores da rede
          </p>
        </div>
      </div>

      {/* Tabela Visual dos Procedimentos Mais Buscados */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <TrendingUp className="size-5 text-teal-600 dark:text-teal-400" />
              <span>Procedimentos e Exames Mais Buscados</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
              Ranking de procedimentos por volume de solicitações dos pacientes.
            </p>
          </div>

          <Button
            render={<Link href="/procedimentos" />}
            nativeButton={false}
            variant="ghost"
            className="text-xs font-bold text-teal-700 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300"
          >
            Ver Catálogo Geral
          </Button>
        </div>

        {kpis.topProcedures.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center border border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/40">
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Nenhum agendamento registrado ainda</p>
            <p className="text-xs text-slate-400 mt-1">Os procedimentos aparecerão aqui conforme forem solicitados.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {kpis.topProcedures.map((procedure, index) => {
              const percentage = Math.round((procedure.count / maxProcedureCount) * 100);
              const rankColor =
                index === 0
                  ? "bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                  : index === 1
                  ? "bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700"
                  : index === 2
                  ? "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900"
                  : "bg-slate-50 dark:bg-slate-800/40 text-slate-600 dark:text-slate-400 border-slate-100 dark:border-slate-800";

              return (
                <div
                  key={procedure.name}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-xl font-mono text-xs font-bold border ${rankColor}`}
                    >
                      #{index + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-slate-900 dark:text-slate-100 text-sm">{procedure.name}</p>
                        <span className="rounded-md bg-teal-50 dark:bg-teal-950/60 px-2 py-0.5 text-[10px] font-bold text-teal-800 dark:text-teal-300 font-mono border border-teal-200/60 dark:border-teal-800">
                          {procedure.specialty}
                        </span>
                      </div>

                      {/* Visual Bar */}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200/80 dark:bg-slate-700">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 transition-all duration-500"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 shrink-0">
                    <span className="font-extrabold text-slate-900 dark:text-slate-100 text-base font-mono">{procedure.count}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">solicitações</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
