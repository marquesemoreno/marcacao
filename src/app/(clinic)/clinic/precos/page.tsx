import {
  getClinicInfo,
  listClinicProcedures,
  listProceduresNotOffered,
  listAcquisitionRules,
} from "@/actions/clinic";
import { ReportSettingsForm } from "@/components/clinic/report-settings-form";
import { BusinessHoursForm } from "@/components/clinic/business-hours-form";
import { ClinicProcedureForm } from "@/components/clinic/clinic-procedure-form";
import { AddProcedureForm } from "@/components/clinic/add-procedure-form";
import { TrackedLinksCard } from "@/components/clinic/tracked-links-card";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { buildWhatsAppLink } from "@/lib/format";
import type { BusinessHours } from "@/lib/schemas/clinic";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ClinicSettingsPage() {
  const [clinic, clinicProcedures, availableProcedures, acquisitionRules] = await Promise.all([
    getClinicInfo(),
    listClinicProcedures(),
    listProceduresNotOffered(),
    listAcquisitionRules(),
  ]);

  const businessHours = (clinic.businessHours as BusinessHours | null) ?? ({} as Partial<BusinessHours>);

  const trackedLinks = clinic.whatsapp
    ? [
        { channel: "Google Meu Negócio", url: buildWhatsAppLink(clinic.whatsapp, "Olá! Vim pelo Google e quero agendar uma consulta.") },
        { channel: "Instagram (Bio)", url: buildWhatsAppLink(clinic.whatsapp, "Olá! Vim pelo Instagram e quero agendar uma consulta.") },
        { channel: "Facebook", url: buildWhatsAppLink(clinic.whatsapp, "Olá! Vim pelo Facebook e quero agendar uma consulta.") },
      ]
    : [];

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

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-800">Relatórios e origem dos pacientes</h2>
        <ReportSettingsForm defaultTicket={clinic.defaultTicket?.toString() ?? null} rules={acquisitionRules} />
        {trackedLinks.length > 0 && <TrackedLinksCard links={trackedLinks} />}
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
