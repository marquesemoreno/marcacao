import { MessageSquare } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listMspLeads } from "@/actions/msp-leads";
import { MspLeadStatusForm } from "@/components/admin/msp-lead-status-form";
import { MspOutreachControl } from "@/components/admin/msp-outreach-control";
import { AddMspLeadDialog } from "@/components/admin/add-msp-lead-dialog";
import { ImportMspLeadsCsvDialog } from "@/components/admin/import-msp-leads-csv-dialog";
import { SendMspOutreachButton } from "@/components/admin/send-msp-outreach-button";
import { mspLeadStatusLabels, mspLeadStatusVariant, formatPhone, buildWhatsAppLink } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMspLeadsPage() {
  const leads = await listMspLeads();

  return (
    <div className="space-y-6 p-4 sm:p-6 flex-1 overflow-y-auto font-sans text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads de Prospecção MSP</h1>
          <p className="text-sm text-muted-foreground">
            Prospecção de clientes de suporte de TI da própria TIVDC — primeiro contato pela
            mesma instância WhatsApp usada no atendimento da TIVDC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <AddMspLeadDialog />
          <ImportMspLeadsCsvDialog />
        </div>
      </div>

      <MspOutreachControl />

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lead de MSP cadastrado ainda.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {lead.name}
                  <Badge variant={mspLeadStatusVariant[lead.status]}>
                    {mspLeadStatusLabels[lead.status]}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {[lead.segment, lead.city].filter(Boolean).join(" · ") || "—"}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Telefone: </span>
                    {formatPhone(lead.phone)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">Canal: </span>
                    {lead.channel ?? "—"}
                  </p>
                  {lead.notes && (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Observações: </span>
                      {lead.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <div className="flex flex-wrap gap-2">
                    <SendMspOutreachButton leadId={lead.id} />
                    {lead.contactId ? (
                      <Button
                        render={<a href={`/admin/inbox?c=${lead.contactId}`} />}
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <MessageSquare className="h-4 w-4" />
                        Ver conversa
                      </Button>
                    ) : (
                      <Button
                        render={
                          <a
                            href={buildWhatsAppLink(lead.phone)}
                            target="_blank"
                            rel="noopener noreferrer"
                          />
                        }
                        nativeButton={false}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                      >
                        <WhatsAppIcon className="h-4 w-4" />
                        Chamar no WhatsApp
                      </Button>
                    )}
                  </div>
                  <MspLeadStatusForm leadId={lead.id} status={lead.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
