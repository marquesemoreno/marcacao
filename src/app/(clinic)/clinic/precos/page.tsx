import {
  getClinicInfo,
  listClinicProcedures,
  listProceduresNotOffered,
  listAcquisitionRules,
} from "@/actions/clinic";
import { PageHeader } from "@/components/clinic/page-header";
import { PrecosPageTabs } from "@/components/clinic/precos-page-tabs";
import { toPlainClinicProcedureItem } from "@/lib/serialize";
import { buildWhatsAppLink } from "@/lib/format";
import type { BusinessHours } from "@/lib/schemas/clinic";

export const metadata = { title: "Preços e Horários" };

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
        { channel: "Site da Clínica", url: buildWhatsAppLink(clinic.whatsapp, "Olá! Vim pelo site e quero agendar uma consulta.") },
      ]
    : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Configurações" subtitle={`Preços, horários e parâmetros · ${clinicProcedures.length} procedimento(s)`} />

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
