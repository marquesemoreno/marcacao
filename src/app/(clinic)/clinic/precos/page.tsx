import {
  getClinicInfo,
  listClinicProcedures,
  listProceduresNotOffered,
} from "@/actions/clinic";
import { BusinessHoursForm } from "@/components/clinic/business-hours-form";
import { ClinicProcedureForm } from "@/components/clinic/clinic-procedure-form";
import { AddProcedureForm } from "@/components/clinic/add-procedure-form";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import type { BusinessHours } from "@/lib/schemas/clinic";

export default async function ClinicSettingsPage() {
  const [clinic, clinicProcedures, availableProcedures] = await Promise.all([
    getClinicInfo(),
    listClinicProcedures(),
    listProceduresNotOffered(),
  ]);

  const businessHours = (clinic.businessHours as BusinessHours | null) ?? ({} as Partial<BusinessHours>);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Preços e Horários</h1>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Horários de atendimento</h2>
        <BusinessHoursForm businessHours={businessHours} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Tabela de preços</h2>
        <div className="space-y-3">
          {clinicProcedures.map((cp) => (
            <ClinicProcedureForm key={cp.id} item={toPlainClinicProcedureItem(cp)} />
          ))}
        </div>
      </section>

      {availableProcedures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Adicionar procedimento</h2>
          <AddProcedureForm availableProcedures={availableProcedures} />
        </section>
      )}
    </div>
  );
}
