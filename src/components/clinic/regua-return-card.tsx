import { formatCurrency } from "@/lib/format";
import type { computeReguaReturn } from "@/lib/regua-return";

const LABELS: Record<string, string> = { RETORNO: "Retorno", REATIVACAO: "Reativação" };

/** O que a régua de retorno/reativação trouxe — só aparece quando houve envio no período. */
export function ReguaReturnCard({ data }: { data: ReturnType<typeof computeReguaReturn> }) {
  if (!data.totalSent) return null;
  const rate = Math.round((data.totalScheduled / data.totalSent) * 100);
  return (
    <section aria-labelledby="regua-titulo" className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs">
      <h3 id="regua-titulo" className="font-semibold">O que a régua trouxe</h3>
      <p className="mt-3">
        <span className="text-4xl font-semibold tabular-nums">{data.totalScheduled}</span>
        <span className="ml-2 text-sm text-slate-500">
          paciente{data.totalScheduled === 1 ? "" : "s"} agendado{data.totalScheduled === 1 ? "" : "s"} de {data.totalSent} contatado
          {data.totalSent === 1 ? "" : "s"} ({rate}%)
          {data.estimatedRevenue !== null && <> · ≈ {formatCurrency(data.estimatedRevenue)} em consultas</>}
        </span>
      </p>
      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500">
            <th className="font-normal">Passo</th>
            <th className="font-normal text-right">Enviados</th>
            <th className="font-normal text-right">Responderam</th>
            <th className="font-normal text-right">Agendaram</th>
          </tr>
        </thead>
        <tbody className="tabular-nums">
          {data.rows.map((r) => (
            <tr key={r.kind} className="border-t border-slate-100 dark:border-slate-800">
              <td className="py-1.5 text-slate-700 dark:text-slate-300">{LABELS[r.kind] ?? r.kind}</td>
              <td className="text-right">{r.sent}</td>
              <td className="text-right">{r.replied}</td>
              <td className="text-right font-semibold">{r.scheduled}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-xs text-slate-400">
        Conta quem foi para “Agendado” ou teve o atendimento finalizado como agendamento em até 30 dias após a mensagem. Valor pelo ticket médio.
      </p>
    </section>
  );
}
