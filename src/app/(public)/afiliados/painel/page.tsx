import { QRCodeSVG } from "qrcode.react";
import { Users, CheckCircle2, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AffiliateLoginForm } from "@/components/public/affiliate-login-form";
import { AffiliateCopyLinkButton } from "@/components/public/affiliate-copy-link-button";
import { AffiliateLogoutButton } from "@/components/public/affiliate-logout-button";
import { getAffiliateSession, getAffiliateDashboard } from "@/actions/affiliates";
import {
  formatCurrency,
  formatDate,
  appointmentStatusLabels,
  appointmentStatusVariant,
  getBaseUrl,
} from "@/lib/format";

export const metadata = {
  title: "Painel do Marcador | Conecta Saúde",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AffiliatePanelPage() {
  const session = await getAffiliateSession();

  if (!session) {
    return (
      <main className="mx-auto flex max-w-md flex-col gap-6 px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Painel do Marcador</h1>
          <p className="mt-2 text-sm text-slate-600">
            Entre com o WhatsApp e o código que você recebeu na ativação do seu cadastro.
          </p>
        </div>
        <AffiliateLoginForm />
      </main>
    );
  }

  const { affiliate, referralsThisMonth, confirmedCount, history } = await getAffiliateDashboard(
    session.id
  );
  const referralLink = `${getBaseUrl()}/?ref=${affiliate.code}`;

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Olá, {affiliate.name.split(" ")[0]}! 👋</h1>
          <p className="text-sm text-slate-600">
            Código de marcador: <span className="font-mono font-semibold text-slate-900">{affiliate.code}</span>
          </p>
        </div>
        <AffiliateLogoutButton />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Seu link de divulgação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div className="flex shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
            <QRCodeSVG value={referralLink} size={120} level="M" />
          </div>
          <div className="flex w-full flex-col gap-3">
            <p className="break-all rounded-xl bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700">
              {referralLink}
            </p>
            <AffiliateCopyLinkButton link={referralLink} />
          </div>
        </CardContent>
      </Card>

      {/* Cards Principais Financeiros */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="flex items-center gap-3.5 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 shadow-2xs">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-emerald-800">{formatCurrency(affiliate.availableBalance)}</p>
              <p className="text-xs font-semibold text-emerald-700">Saldo Liberado p/ Saque (PIX)</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3.5 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 shadow-2xs">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(affiliate.pendingCommissions)}</p>
              <p className="text-xs font-medium text-slate-500">Comissões Pendentes</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3.5 pt-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 shadow-2xs">
              <Users className="h-5 w-5" />
            </span>
            <div>
              <p className="text-2xl font-bold text-slate-900">{formatCurrency(affiliate.totalPaid)}</p>
              <p className="text-xs font-medium text-slate-500">Total Já Recebido (PIX)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumo de Desempenho de Indicações */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs font-medium text-slate-600">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-emerald-600" />
          <span>Indicações no Mês: <strong className="font-bold text-slate-900">{referralsThisMonth}</strong></span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Atendimentos Concluídos: <strong className="font-bold text-slate-900">{confirmedCount}</strong></span>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de Indicações</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma indicação ainda. Compartilhe seu link para começar a receber!
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Procedimento</TableHead>
                    <TableHead>Clínica</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Status Atendimento</TableHead>
                    <TableHead>Status Comissão</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {history.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.patientName}</TableCell>
                      <TableCell>{item.procedureName}</TableCell>
                      <TableCell>{item.clinicName}</TableCell>
                      <TableCell>{formatDate(item.date)}</TableCell>
                      <TableCell>
                        <Badge variant={appointmentStatusVariant[item.status]}>
                          {appointmentStatusLabels[item.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            item.commissionStatusLabel === "Liberada (PIX)"
                              ? "bg-emerald-100 text-emerald-800"
                              : item.commissionStatusLabel === "Cancelada"
                              ? "bg-rose-100 text-rose-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {item.commissionStatusLabel}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-slate-900">
                        {formatCurrency(item.commission)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
