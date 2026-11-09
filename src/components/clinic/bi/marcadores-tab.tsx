import { Suspense } from "react";
import Link from "next/link";
import { getMarcadoresReport } from "@/actions/marcadores";
import { MarcadoresTable } from "@/components/clinic/marcadores-table";
import { PeriodFilter } from "@/components/clinic/period-filter";
import { parsePeriodKey, periodLabels, periodWindow } from "@/lib/report-period";

const ymdSP = (d: Date) => new Date(d.getTime() - 3 * 3600_000).toISOString().slice(0, 10);

/** Relatórios › Marcadores: indicados → agendados → atendidos por marcador no período. */
export async function MarcadoresTab({ periodo, days }: { periodo?: string; days?: string }) {
  const period = parsePeriodKey(periodo, days);
  const win = periodWindow(period, false);
  const from = ymdSP(win.since);
  const to = ymdSP(win.until ? new Date(win.until.getTime() - 1) : new Date());
  const { rows, clinicWhatsapp } = await getMarcadoresReport(from, to);
  const label = periodLabels(period).title;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Marcadores — {label}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Fonte: conversas que chegaram pelo link de cada marcador e a Agenda do Conecta · {from.split("-").reverse().join("/")} a{" "}
            {to.split("-").reverse().join("/")} · cadastro e links em{" "}
            <Link href="/clinic/marcadores" className="font-medium text-sky-700 underline underline-offset-2 dark:text-sky-400">
              Marcadores
            </Link>
          </p>
        </div>
        <Suspense>
          <PeriodFilter basePath="/clinic/relatorio" />
        </Suspense>
      </div>
      <MarcadoresTable rows={rows} hasClinicWhatsapp={!!clinicWhatsapp} mode="relatorio" periodLabel={label} />
    </div>
  );
}
