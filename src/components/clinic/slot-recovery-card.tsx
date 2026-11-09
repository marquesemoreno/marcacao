import { formatCurrency } from "@/lib/format";
import type { summarizeSlotRecovery } from "@/lib/slot-recovery";

/** Vagas recuperadas pela lista de espera — some quando a clínica não usa a lista. */
export function SlotRecoveryCard({ data }: { data: ReturnType<typeof summarizeSlotRecovery> }) {
  if (!data.offered && !data.waiting && !data.bookedManually) return null;
  const stats = [
    { label: "Oferecidas sozinhas", value: data.offered },
    { label: "Aceitas pelo paciente", value: data.filled },
    { label: "Ninguém aceitou", value: data.expired },
    { label: "Encaixadas pela recepção", value: data.bookedManually },
  ];
  return (
    <section aria-labelledby="vagas-titulo" className="report-surface p-5">
      <h3 id="vagas-titulo" className="font-semibold">Vagas recuperadas</h3>
      <p className="mt-3">
        <span className="text-4xl font-semibold tabular-nums">{data.recovered}</span>
        <span className="ml-2 text-sm text-slate-500">
          horário{data.recovered === 1 ? "" : "s"} de cancelamento ou falta ocupado{data.recovered === 1 ? "" : "s"} pela lista de espera
          {data.recoveredRevenue !== null && <> · ≈ {formatCurrency(data.recoveredRevenue)}</>}
        </span>
      </p>
      <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label}>
            <dt className="text-slate-500">{s.label}</dt>
            <dd className="font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-slate-400">
        {data.fillRate !== null && <>{data.fillRate}% das vagas oferecidas foram aceitas. </>}
        {data.waiting} paciente{data.waiting === 1 ? "" : "s"} esperando vaga agora{data.open ? ` · ${data.open} oferta${data.open === 1 ? "" : "s"} em andamento` : ""}.
        Valor pelo ticket médio.
      </p>
    </section>
  );
}
