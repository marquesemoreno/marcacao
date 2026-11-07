import { PageHeader } from "@/components/clinic/page-header";
import { listMyProcessFeedback, listProcessFeedback, listProcesses } from "@/actions/processes";
import { ProcessesApp } from "@/components/clinic/processes-app";

export const metadata = { title: "Processos" };
export const dynamic = "force-dynamic";

/** Processos de cada setor: a equipe consulta, tira dúvida e manda opinião/reclamação. */
export default async function ProcessosPage() {
  const { manager, processes } = await listProcesses();
  const [feedback, mine] = await Promise.all([manager ? listProcessFeedback() : Promise.resolve([]), listMyProcessFeedback()]);
  const toIso = <T extends { createdAt: Date }>(r: T) => ({ ...r, createdAt: r.createdAt.toISOString() });

  return (
    <div className="h-full overflow-y-auto">
      <div className="space-y-5 p-4 sm:p-6 max-w-5xl">
        <PageHeader
          title="Processos"
          subtitle="Como cada setor trabalha, passo a passo. Tire dúvidas e mande sugestões ou reclamações para a gestão."
        />
        <ProcessesApp
          manager={manager}
          processes={processes.map((p) => ({
            ...p,
            publishedAt: p.publishedAt?.toISOString() ?? null,
            updatedAt: p.updatedAt.toISOString(),
          }))}
          feedback={feedback.map(toIso)}
          mine={mine.map(toIso)}
        />
      </div>
    </div>
  );
}
