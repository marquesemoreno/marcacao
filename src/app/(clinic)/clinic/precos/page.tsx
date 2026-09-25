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

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClinicSettingsPage() {
  const [clinic, clinicProcedures, availableProcedures] = await Promise.all([
    getClinicInfo(),
    listClinicProcedures(),
    listProceduresNotOffered(),
  ]);

  const businessHours = (clinic.businessHours as BusinessHours | null) ?? ({} as Partial<BusinessHours>);

  return (
    <div className="space-y-8">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Preços e Horários</h1>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Horários de atendimento</h2>
        <BusinessHoursForm businessHours={businessHours} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Tabela de preços</h2>
        <div className="space-y-3">
          {clinicProcedures.map((cp) => (
            <ClinicProcedureForm key={cp.id} item={toPlainClinicProcedureItem(cp)} />
          ))}
        </div>
      </section>

      {availableProcedures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-800">Adicionar procedimento</h2>
          <AddProcedureForm availableProcedures={availableProcedures} />
        </section>
      )}
    </div>
  );
}
