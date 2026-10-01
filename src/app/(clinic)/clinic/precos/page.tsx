import {
  getClinicInfo,
  listClinicProcedures,
  listProceduresNotOffered,
  listAcquisitionRules,
} from "@/actions/clinic";
import { PrecosPageTabs } from "@/components/clinic/precos-page-tabs";
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
    <div className="space-y-6">
      <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">Preços e Horários</h1>

      <PrecosPageTabs
        businessHours={businessHours}
        clinicProcedures={clinicProcedures.map(toPlainClinicProcedureItem)}
        availableProcedures={availableProcedures}
        defaultTicket={clinic.defaultTicket?.toString() ?? null}
        acquisitionRules={acquisitionRules}
        trackedLinks={trackedLinks}
      />
    </div>
  );
}
