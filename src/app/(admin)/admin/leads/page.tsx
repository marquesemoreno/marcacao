import { MessageCircle, Mail, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listPartnerLeads } from "@/actions/partner-leads";
import { PartnerLeadStatusForm } from "@/components/admin/partner-lead-status-form";
import { ApproveClinicDialog } from "@/components/admin/approve-clinic-dialog";
import {
  partnerLeadStatusLabels,
  partnerLeadStatusVariant,
  formatPhone,
  buildWhatsAppLink,
  getBaseUrl,
} from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminLeadsPage() {
  const leads = await listPartnerLeads();
  const partnerUrl = `${getBaseUrl()}/seja-parceiro`;

  return (
    <div className="space-y-6 p-4 sm:p-6 flex-1 overflow-y-auto font-sans text-slate-900 dark:text-slate-100">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Leads de Clínicas Parceiras</h1>
          <p className="text-sm text-muted-foreground">
            Contatos recebidos pelo formulário público em <code>/seja-parceiro</code>.
          </p>
        </div>
        <Button
          render={<a href="/seja-parceiro" target="_blank" rel="noopener noreferrer" />}
          nativeButton={false}
          variant="outline"
          size="sm"
          className="gap-1.5"
        >
          <FileText className="h-4 w-4" />
          Página de Credenciamento
        </Button>
      </div>

      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum lead recebido ainda.</p>
      ) : (
        <div className="space-y-3">
          {leads.map((lead) => (
            <Card key={lead.id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {lead.clinicName}
                  <Badge variant={partnerLeadStatusVariant[lead.status]}>
                    {partnerLeadStatusLabels[lead.status]}
                  </Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {lead.contactName} · {lead.neighborhood}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                  <p>
                    <span className="text-muted-foreground">Telefone: </span>
                    {formatPhone(lead.phone)}
                  </p>
                  <p>
                    <span className="text-muted-foreground">E-mail: </span>
                    {lead.email}
                  </p>
                  <p className="sm:col-span-2">
                    <span className="text-muted-foreground">Especialidades/exames: </span>
                    {lead.specialties}
                  </p>
                  {lead.notes && (
                    <p className="sm:col-span-2">
                      <span className="text-muted-foreground">Observações: </span>
                      {lead.notes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3">
                  <div className="flex gap-2">
                    <Button
                      render={
                        <a
                          href={buildWhatsAppLink(
                            lead.phone,
                            `Olá, ${lead.contactName}! Vi seu cadastro de interesse em ser parceiro da Conecta Saúde. Podemos conversar?`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                      nativeButton={false}
                      size="sm"
                      className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      Chamar no WhatsApp
                    </Button>
                    <Button
                      render={<a href={`mailto:${lead.email}`} />}
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <Mail className="h-4 w-4" />
                      E-mail
                    </Button>
                    <Button
                      render={
                        <a
                          href={buildWhatsAppLink(
                            lead.phone,
                            `Olá, ${lead.contactName}! Segue o link de credenciamento da Conecta Saúde para a ${lead.clinicName}: ${partnerUrl}`
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                        />
                      }
                      nativeButton={false}
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                    >
                      <FileText className="h-4 w-4" />
                      Enviar Proposta
                    </Button>
                    {lead.status !== "PARTNER" && (
                      <ApproveClinicDialog
                        leadId={lead.id}
                        clinicName={lead.clinicName}
                        phone={lead.phone}
                        neighborhood={lead.neighborhood}
                      />
                    )}
                  </div>
                  <PartnerLeadStatusForm leadId={lead.id} status={lead.status} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
