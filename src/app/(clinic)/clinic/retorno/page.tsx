import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { PageHeader } from "@/components/clinic/page-header";
import { ReturnIntervalSettings } from "@/components/clinic/return-interval-settings";
import { getReturnIntervalSettings } from "@/actions/return-intervals";

export const metadata = { title: "Retorno" };
export const dynamic = "force-dynamic";

export default async function RetornoPage() {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const settings = await getReturnIntervalSettings();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <PageHeader
          title="Retorno"
          subtitle="Em quantos dias cada paciente deve voltar. Vale para o passo Retorno da régua e para o “Retorno sugerido” na Agenda."
        />
        <ReturnIntervalSettings initial={settings} />
      </div>
    </div>
  );
}
