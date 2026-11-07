import type { HoursSavedSummary } from "@/lib/hours-saved";

function fmtHours(h: number) {
  if (h < 1) return `${Math.round(h * 60)} min`;
  return `${h.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} h`;
}

/** Horas que a recepção deixou de gastar com mensagens que o sistema mandou sozinho. */
export function HoursSavedCard({ data }: { data: HoursSavedSummary }) {
  if (!data.totalMessages) return null;
  const days = data.totalHours / 8;
  return (
    <section aria-labelledby="horas-titulo" className="rounded-2xl bg-white dark:bg-slate-900 p-5 shadow-xs">
      <h3 id="horas-titulo" className="font-semibold">Horas poupadas pela automação</h3>
      <p className="mt-3">
        <span className="text-4xl font-semibold tabular-nums">{fmtHours(data.totalHours)}</span>
        <span className="ml-2 text-sm text-slate-500">
          {data.totalMessages.toLocaleString("pt-BR")} mensagens enviadas sozinhas
          {days >= 1 && <> · ≈ {days.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias de recepção</>}
        </span>
      </p>
      <ul className="mt-4 grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
        {data.categories.map((c) => (
          <li key={c.key} className="flex justify-between gap-3">
            <span className="text-slate-700 dark:text-slate-300">{c.label}</span>
            <span className="tabular-nums text-slate-500">
              {c.count.toLocaleString("pt-BR")} · {fmtHours(c.hours)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-slate-400">Estimativa de 45 segundos por mensagem que a recepção precisaria digitar.</p>
    </section>
  );
}
