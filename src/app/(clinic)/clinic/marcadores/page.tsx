import Link from "next/link";
import { PageHeader } from "@/components/clinic/page-header";
import { MarcadoresTable } from "@/components/clinic/marcadores-table";
import { getMarcadoresReport } from "@/actions/marcadores";

export const metadata = { title: "Marcadores" };
export const dynamic = "force-dynamic";

/** Cadastro dos marcadores. O desempenho (indicados → agendados → atendidos) fica em
 * Relatórios › Marcadores (09/11/2026). */
export default async function MarcadoresPage() {
  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const { rows, clinicWhatsapp } = await getMarcadoresReport(today, today);

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-4 md:p-6 max-w-6xl">
        <PageHeader
          title="Marcadores"
          subtitle="Parceiros que indicam pacientes. Cada um tem um link de WhatsApp próprio: quem chega por ele entra no relatório."
          actions={
            <Link
              href="/clinic/relatorio?aba=marcadores"
              className="inline-flex h-9 items-center rounded-full bg-slate-100 px-4 text-sm font-medium text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Ver desempenho
            </Link>
          }
        />
        <MarcadoresTable rows={rows} hasClinicWhatsapp={!!clinicWhatsapp} mode="cadastro" />
      </div>
    </div>
  );
}
