import { ManagerOnly, currentUserIsManager } from "@/components/clinic/manager-only";
import { PageHeader } from "@/components/clinic/page-header";
import { FormSettings } from "@/components/clinic/form-settings";
import { getFormSettings } from "@/actions/patient-forms";

export const metadata = { title: "Ficha prévia" };
export const dynamic = "force-dynamic";

export default async function FichaPage() {
  if (!(await currentUserIsManager())) return <ManagerOnly />;
  const settings = await getFormSettings();
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
        <PageHeader
          title="Ficha prévia"
          subtitle="O paciente recebe o link junto com o lembrete da véspera, responde pelo celular e avisa a chegada pelo mesmo link."
        />
        <FormSettings initial={settings} />
      </div>
    </div>
  );
}
