import { PageHeader } from "@/components/clinic/page-header";
import { QueuePanel } from "@/components/clinic/queue-panel";
import { getQueue } from "@/actions/queue-ticket";

export const metadata = { title: "Senhas" };
export const dynamic = "force-dynamic";

export default async function SenhasPage() {
  const initial = await getQueue();
  return (
    // Visual "vidro" (09/11/2026, DESIGN.md §5).
    <div className="soft-canvas h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 md:p-8">
        <PageHeader title="Senhas" subtitle="Fila do totem. Preferencial é chamada primeiro; a TV mostra e fala a senha." />
        <QueuePanel initial={initial} />
      </div>
    </div>
  );
}
