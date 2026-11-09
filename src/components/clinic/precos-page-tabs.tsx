"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BusinessHoursForm } from "@/components/clinic/business-hours-form";
import { ProceduresTable } from "@/components/clinic/procedures-table";
import { ReportSettingsForm } from "@/components/clinic/report-settings-form";
import { TrackedLinksCard } from "@/components/clinic/tracked-links-card";
import { CampaignExclusionsCard } from "@/components/clinic/campaign-exclusions-card";
import type { BusinessHours } from "@/lib/schemas/clinic";
import type { PlainClinicProcedureItem } from "@/lib/serialize";
import type { Procedure } from "@prisma/client";

/** Client component — recebe tudo já buscado pela page (server component) como
 * props. Só reorganiza em abas o que já existia em /clinic/precos antes: Horários
 * (BusinessHoursForm), Preços (agora ProceduresTable em vez dos cards empilhados) e
 * Parâmetros/Links (ReportSettingsForm + TrackedLinksCard). */
// Aba ativa bem visível também no modo escuro (o padrão do shadcn é quase invisível no trilho cinza).
const trig = "!flex-none shrink-0 !rounded-full !border-0 px-3 after:!hidden aria-selected:!bg-slate-900 aria-selected:!text-white dark:aria-selected:!bg-white dark:aria-selected:!text-slate-900";

export function PrecosPageTabs({
  businessHours,
  clinicProcedures,
  availableProcedures,
  defaultTicket,
  acquisitionRules,
  trackedLinks,
  whatsapp,
  technicalDirectorName = null,
  technicalDirectorCrm = null,
  googleReviewUrl = null,
}: {
  businessHours: Partial<BusinessHours>;
  clinicProcedures: PlainClinicProcedureItem[];
  availableProcedures: Procedure[];
  defaultTicket: string | null;
  acquisitionRules: { id: string; keyword: string; channel: string }[];
  trackedLinks: { channel: string; url: string }[];
  whatsapp: string | null;
  technicalDirectorName?: string | null;
  technicalDirectorCrm?: string | null;
  googleReviewUrl?: string | null;
}) {
  return (
    <Tabs defaultValue="horarios" className="gap-4 min-w-0">
      {/* Fixa no topo do contêiner de rolagem da página (lista de procedimentos é longa). */}
      <TabsList className="glass-surface sticky top-0 z-10 !h-auto max-w-full w-fit !flex-nowrap justify-start overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden !rounded-full p-1">
        <TabsTrigger value="horarios" className={trig}>Horários de Atendimento</TabsTrigger>
        <TabsTrigger value="precos" className={trig}>Procedimentos e Preços</TabsTrigger>
        <TabsTrigger value="parametros" className={trig}>Parâmetros, Links e Campanhas</TabsTrigger>
      </TabsList>

      <TabsContent value="horarios" className="min-w-0 !outline-none focus:!outline-none focus-visible:!ring-0">
        <BusinessHoursForm businessHours={businessHours} />
      </TabsContent>

      <TabsContent value="precos" className="min-w-0 !outline-none focus:!outline-none focus-visible:!ring-0">
        <ProceduresTable clinicProcedures={clinicProcedures} availableProcedures={availableProcedures} />
      </TabsContent>

      <TabsContent value="parametros" className="min-w-0 !outline-none focus:!outline-none focus-visible:!ring-0 space-y-3">
        <ReportSettingsForm defaultTicket={defaultTicket} rules={acquisitionRules} technicalDirectorName={technicalDirectorName} technicalDirectorCrm={technicalDirectorCrm} googleReviewUrl={googleReviewUrl} />
        {trackedLinks.length > 0 && <TrackedLinksCard links={trackedLinks} whatsapp={whatsapp} />}
        <CampaignExclusionsCard />
      </TabsContent>
    </Tabs>
  );
}
