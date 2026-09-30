"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BusinessHoursForm } from "@/components/clinic/business-hours-form";
import { ProceduresTable } from "@/components/clinic/procedures-table";
import { ReportSettingsForm } from "@/components/clinic/report-settings-form";
import { TrackedLinksCard } from "@/components/clinic/tracked-links-card";
import type { BusinessHours } from "@/lib/schemas/clinic";
import type { PlainClinicProcedureItem } from "@/lib/serialize";
import type { Procedure } from "@prisma/client";

/** Client component — recebe tudo já buscado pela page (server component) como
 * props. Só reorganiza em abas o que já existia em /clinic/precos antes: Horários
 * (BusinessHoursForm), Preços (agora ProceduresTable em vez dos cards empilhados) e
 * Parâmetros/Links (ReportSettingsForm + TrackedLinksCard). */
export function PrecosPageTabs({
  businessHours,
  clinicProcedures,
  availableProcedures,
  defaultTicket,
  acquisitionRules,
  trackedLinks,
}: {
  businessHours: Partial<BusinessHours>;
  clinicProcedures: PlainClinicProcedureItem[];
  availableProcedures: Procedure[];
  defaultTicket: string | null;
  acquisitionRules: { id: string; keyword: string; channel: string }[];
  trackedLinks: { channel: string; url: string }[];
}) {
  return (
    <Tabs defaultValue="horarios" className="gap-4">
      <TabsList>
        <TabsTrigger value="horarios">Horários de Atendimento</TabsTrigger>
        <TabsTrigger value="precos">Procedimentos e Preços</TabsTrigger>
        <TabsTrigger value="parametros">Parâmetros e Links Rastreados</TabsTrigger>
      </TabsList>

      <TabsContent value="horarios">
        <BusinessHoursForm businessHours={businessHours} />
      </TabsContent>

      <TabsContent value="precos">
        <ProceduresTable clinicProcedures={clinicProcedures} availableProcedures={availableProcedures} />
      </TabsContent>

      <TabsContent value="parametros" className="space-y-3">
        <ReportSettingsForm defaultTicket={defaultTicket} rules={acquisitionRules} />
        {trackedLinks.length > 0 && <TrackedLinksCard links={trackedLinks} />}
      </TabsContent>
    </Tabs>
  );
}
