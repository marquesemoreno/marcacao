import type { AgendaRiskRow, computeFunnel, computeWeeklyTrend } from "@/lib/report-insights";
import { formatCurrency } from "@/lib/format";

const card = "bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-xs";
const pctBR = (n: number) => `${n.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Funil conversa → agendamento, com a etapa que mais perde e o valor parado. */
export function FunnelCard({ funnel }: { funnel: ReturnType<typeof computeFunnel> }) {
  const max = Math.max(1, funnel.steps[0]?.count ?? 0);
  return (
    <div className={`${card} p-5 space-y-4`}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Funil de atendimento</h3>
        {funnel.opportunity.patients > 0 && (
          <p className="text-sm text-slate-700 dark:text-slate-300">
            <span className="font-semibold tabular-nums">{funnel.opportunity.patients}</span> paciente(s) sem agendamento
            {funnel.opportunity.value !== null && (
              <>
                {" "}· cerca de <span className="font-semibold">{formatCurrency(funnel.opportunity.value)}</span> em oportunidade
              </>
            )}
          </p>
        )}
      </div>
      <ol className="space-y-2">
        {funnel.steps.map((s, i) => {
          const isDrop = funnel.biggestDrop?.to === s.key;
          return (
            <li key={s.key} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-sm">
              <span className="text-slate-700 dark:text-slate-300">{s.label}</span>
              <div className="h-6 rounded bg-slate-100 dark:bg-slate-800 overflow-hidden">
                <div
                  className={`h-full rounded ${i === funnel.steps.length - 1 ? "bg-emerald-500" : isDrop ? "bg-rose-400" : "bg-sky-500"}`}
                  style={{ width: `${(s.count / max) * 100}%` }}
                />
              </div>
              <span className="tabular-nums text-slate-900 dark:text-slate-100 w-24 text-right">
                {s.count} <span className="text-xs text-slate-500 dark:text-slate-400">({pctBR(s.pctOfTotal)})</span>
              </span>
            </li>
          );
        })}
      </ol>
      {funnel.biggestDrop && (
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Maior perda: <span className="font-medium text-rose-700 dark:text-rose-400">{funnel.biggestDrop.lost}</span> paciente(s) entre “
          {funnel.steps.find((s) => s.key === funnel.biggestDrop!.from)?.label}” e “{funnel.steps.find((s) => s.key === funnel.biggestDrop!.to)?.label}”.
          {funnel.biggestDrop.to === "atendidas" && " Conversas sem nenhuma resposta da equipe."}
          {funnel.biggestDrop.to === "com_desfecho" && " Conversas que terminaram por inatividade ou ainda estão abertas — vale retomar contato."}
          {funnel.biggestDrop.to === "agendaram" && " Conversas com desfecho que não viraram agendamento — veja os motivos de perda abaixo."}
        </p>
      )}
    </div>
  );
}

/** Semana a semana: conversas (barra) e conversão (número embaixo). */
export function WeeklyTrendCard({ weeks }: { weeks: ReturnType<typeof computeWeeklyTrend> }) {
  const max = Math.max(1, ...weeks.map((w) => w.conversations));
  return (
    <div className={`${card} p-5 space-y-3`}>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Semana a semana</h3>
      {weeks.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Sem dados no período.</p>
      ) : (
        <div className="flex items-end gap-2 h-40" role="img" aria-label="Conversas e agendamentos por semana">
          {weeks.map((w) => (
            <div key={w.label} className="flex-1 min-w-0 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-[11px] tabular-nums text-slate-600 dark:text-slate-400">{w.conversations}</span>
              <div className="w-full max-w-10 flex flex-col justify-end rounded-t bg-sky-200 dark:bg-sky-900" style={{ height: `${(w.conversations / max) * 100}%` }}>
                <div className="w-full rounded-t bg-emerald-500" style={{ height: w.conversations ? `${(w.scheduled / w.conversations) * 100}%` : 0 }} />
              </div>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">{w.label}</span>
              <span className="text-[11px] font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{w.rate !== null ? pctBR(w.rate) : "—"}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        <span className="inline-block w-2 h-2 rounded-sm bg-sky-300 dark:bg-sky-800 mr-1" />
        conversas · <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500 mx-1" />
        agendaram · % = agendaram / conversas da semana
      </p>
    </div>
  );
}

export function PatientsCard({ patients }: { patients: { newPatients: number; returning: number; newPct: number } }) {
  const total = patients.newPatients + patients.returning;
  return (
    <div className={`${card} p-5 space-y-3`}>
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Pacientes novos x que já conheciam a clínica</h3>
      {total === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">Sem conversas no período.</p>
      ) : (
        <>
          <div className="flex h-3 rounded-full overflow-hidden bg-slate-100 dark:bg-slate-800">
            <div className="bg-violet-500" style={{ width: `${patients.newPct}%` }} />
            <div className="bg-slate-400 dark:bg-slate-600 flex-1" />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-600 dark:text-slate-400">Novos (1º contato)</dt>
              <dd className="text-2xl font-bold tabular-nums text-violet-700 dark:text-violet-400">{patients.newPatients}</dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">{pctBR(patients.newPct)}</dd>
            </div>
            <div>
              <dt className="text-slate-600 dark:text-slate-400">Já tinham falado antes</dt>
              <dd className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">{patients.returning}</dd>
              <dd className="text-xs text-slate-500 dark:text-slate-400">{pctBR(100 - patients.newPct)}</dd>
            </div>
          </dl>
        </>
      )}
    </div>
  );
}

function RiskTable({ title, rows, first }: { title: string; rows: AgendaRiskRow[]; first: string }) {
  const tone = (p: number) => (p >= 40 ? "text-rose-700 dark:text-rose-400" : p >= 25 ? "text-amber-700 dark:text-amber-400" : "text-emerald-700 dark:text-emerald-400");
  return (
    <div className={`${card} overflow-x-auto`}>
      <h4 className="px-4 pt-4 pb-2 text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h4>
      <table className="w-full text-sm">
        <thead className="text-xs text-slate-500 dark:text-slate-400">
          <tr className="border-b border-slate-200 dark:border-slate-800">
            <th className="px-4 py-2 text-left font-medium">{first}</th>
            <th className="px-2 py-2 text-right font-medium">Agendados</th>
            <th className="px-2 py-2 text-right font-medium">Confirmaram</th>
            <th className="px-2 py-2 text-right font-medium">Cancelaram</th>
            <th className="px-2 py-2 text-right font-medium">Sem resposta</th>
            <th className="px-4 py-2 text-right font-medium">Sem confirmação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b last:border-0 border-slate-100 dark:border-slate-800">
              <td className="px-4 py-2 text-slate-800 dark:text-slate-200">{r.key}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.total}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.confirmed}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.cancelled}</td>
              <td className="px-2 py-2 text-right tabular-nums">{r.noReply}</td>
              <td className={`px-4 py-2 text-right tabular-nums font-semibold ${r.reminded ? tone(r.riskPct) : "text-slate-400"}`}>
                {r.reminded ? pctBR(r.riskPct) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const brDate = (iso: string) => iso.split("-").reverse().join("/");

/** Agenda do sistema da clínica × resposta ao lembrete. */
export function AgendaRiskBlock({
  agenda,
}: {
  agenda: { byDoctor: AgendaRiskRow[]; byWeekday: AgendaRiskRow[]; overall: AgendaRiskRow; days: number; missingDays: number; from: string; to: string };
}) {
  const o = agenda.overall;
  return (
    <div className="space-y-4">
      <dl className={`${card} p-5 grid grid-cols-2 sm:grid-cols-4 gap-4`}>
        <div>
          <dt className="text-sm text-slate-600 dark:text-slate-400">Agendados no sistema</dt>
          <dd className="text-2xl font-bold tabular-nums">{o.total}</dd>
          <dd className="text-xs text-slate-500 dark:text-slate-400">{agenda.days ? `${brDate(agenda.from)} a ${brDate(agenda.to)}` : ""}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600 dark:text-slate-400">Receberam lembrete</dt>
          <dd className="text-2xl font-bold tabular-nums">{o.reminded}</dd>
          <dd className="text-xs text-slate-500 dark:text-slate-400">{o.total ? pctBR((o.reminded / o.total) * 100) : "—"} da agenda</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600 dark:text-slate-400">Confirmaram</dt>
          <dd className="text-2xl font-bold tabular-nums text-emerald-700 dark:text-emerald-400">{o.confirmed}</dd>
        </div>
        <div>
          <dt className="text-sm text-slate-600 dark:text-slate-400">Sem confirmação</dt>
          <dd className="text-2xl font-bold tabular-nums text-rose-700 dark:text-rose-400">{o.reminded ? pctBR(o.riskPct) : "—"}</dd>
          <dd className="text-xs text-slate-500 dark:text-slate-400">cancelaram ou não responderam</dd>
        </div>
      </dl>
      {agenda.missingDays > 0 && (
        <p className="text-xs text-amber-800 dark:text-amber-300">
          {agenda.missingDays} dia(s) sem resposta do sistema da clínica (computador desligado ou fora do ar) — ficaram de fora.
        </p>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <RiskTable title="Por dia da semana" rows={agenda.byWeekday} first="Dia" />
        <RiskTable title="Por médico / agenda" rows={agenda.byDoctor} first="Médico" />
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Sem confirmação = quem recebeu o lembrete e cancelou ou não respondeu — são os pacientes com mais chance de faltar e vale ligar antes. Quem não recebeu
        lembrete (sem celular cadastrado ou marcado em cima da hora) conta só em “Agendados”. O comparecimento real ainda não é registrado: quando a recepção
        marcar “Chegou” na Agenda, dá para mostrar as faltas de fato.
      </p>
    </div>
  );
}
