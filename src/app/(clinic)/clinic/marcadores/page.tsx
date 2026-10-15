import { Suspense } from "react";
import { PageHeader } from "@/components/clinic/page-header";
import { PeriodFilter } from "@/components/clinic/period-filter";
import { MarcadoresTable } from "@/components/clinic/marcadores-table";
import { getMarcadoresReport } from "@/actions/marcadores";

export const metadata = { title: "Marcadores" };
export const dynamic = "force-dynamic";

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - 3 * 3600_000 - days * 86_400_000).toISOString().slice(0, 10);
}

export default async function MarcadoresPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const params = await searchParams;
  const days = [7, 30, 90].includes(Number(params.days)) ? Number(params.days) : 30;
  const to = isoDaysAgo(0);
  const from = isoDaysAgo(days - 1);
  const { rows, clinicWhatsapp } = await getMarcadoresReport(from, to);

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-4 p-4 md:p-6 max-w-6xl">
        <PageHeader
          title="Marcadores"
          subtitle="Parceiros que indicam pacientes. Cada um tem um link de WhatsApp próprio: quem chega por ele entra no relatório."
          actions={
            <Suspense>
              <PeriodFilter basePath="/clinic/marcadores" />
            </Suspense>
          }
        />
        <MarcadoresTable rows={rows} hasClinicWhatsapp={!!clinicWhatsapp} days={days} />
      </div>
    </div>
  );
}
