import { PageHeader } from "@/components/clinic/page-header";
import { QueuePanel } from "@/components/clinic/queue-panel";
import { getQueue } from "@/actions/queue-ticket";

export const metadata = { title: "Senhas" };
export const dynamic = "force-dynamic";

export default async function SenhasPage() {
  const initial = await getQueue();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-4 p-4 md:p-6">
        <PageHeader title="Senhas" subtitle="Fila do totem. Preferencial é chamada primeiro; a TV mostra e fala a senha." />
        <QueuePanel initial={initial} />
      </div>
    </div>
  );
}
