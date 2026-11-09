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
    // Visual "vidro" (09/11/2026, DESIGN.md §5).
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-6xl space-y-5 p-4 sm:p-6 md:p-8">
        <PageHeader
          title="Marcadores"
          subtitle="Parceiros que indicam pacientes. Cada um tem um link de WhatsApp próprio: quem chega por ele entra no relatório."
          actions={
            <Link
              href="/clinic/relatorio?aba=marcadores"
              className="inline-flex h-10 items-center rounded-full bg-white/80 ring-1 ring-slate-900/5 shadow-xs dark:bg-white/[0.08] dark:ring-white/10 hover:bg-white dark:hover:bg-white/[0.14] px-4 text-sm font-medium text-slate-700 dark:text-slate-200"
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
