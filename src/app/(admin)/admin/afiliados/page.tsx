import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { getAffiliates } from "@/actions/affiliates";
import { AffiliateActionsCell } from "@/components/admin/affiliate-actions-cell";
import {
  formatCurrency,
  formatPhone,
  affiliateStatusLabels,
  affiliateStatusVariant,
  pixKeyTypeLabels,
} from "@/lib/format";
import { Users, Wallet, CheckCircle2 } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAffiliatesPage() {
  const affiliates = await getAffiliates();

  const totalEarnedSum = affiliates.reduce((sum, a) => sum + a.totalEarned, 0);
  const totalAvailableSum = affiliates.reduce((sum, a) => sum + a.availableBalance, 0);

  return (
    <div className="space-y-6 p-4 sm:p-6 flex-1 overflow-y-auto font-sans text-slate-900 dark:text-slate-100">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Programa de Marcadores e Afiliados</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Gestão de aprovados, contato WhatsApp, cópia de PIX e controle de repasse financeiro de indicações.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border border-slate-200/80 shadow-2xs">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-bold">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{affiliates.length}</p>
              <p className="text-xs font-medium text-slate-500">Marcadores Cadastrados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-2xs">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 font-bold">
              <CheckCircle2 className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalEarnedSum)}</p>
              <p className="text-xs font-medium text-slate-500">Total Liberado (Atendimentos)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/80 shadow-2xs">
          <CardContent className="flex items-center gap-3.5 p-4">
            <div className="flex size-11 items-center justify-center rounded-xl bg-amber-50 text-amber-600 font-bold">
              <Wallet className="size-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-700">{formatCurrency(totalAvailableSum)}</p>
              <p className="text-xs font-medium text-slate-500">Saldo Pendente a Pagar (PIX)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {affiliates.length === 0 ? (
        <p className="text-sm text-slate-500 italic">Nenhum marcador cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-2xs">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/70">
                <TableHead className="font-bold text-slate-700">Marcador</TableHead>
                <TableHead className="font-bold text-slate-700">Código</TableHead>
                <TableHead className="font-bold text-slate-700">Cidade</TableHead>
                <TableHead className="font-bold text-slate-700">WhatsApp</TableHead>
                <TableHead className="font-bold text-slate-700">Chave PIX</TableHead>
                <TableHead className="font-bold text-slate-700">Status</TableHead>
                <TableHead className="font-bold text-slate-700">Comissão Liberada</TableHead>
                <TableHead className="font-bold text-slate-700">Total Já Pago</TableHead>
                <TableHead className="font-bold text-slate-700">A Pagar (PIX)</TableHead>
                <TableHead className="font-bold text-slate-700 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map((affiliate) => (
                <TableRow key={affiliate.id} className="hover:bg-slate-50/60">
                  <TableCell className="font-bold text-slate-900">{affiliate.name}</TableCell>
                  <TableCell className="font-mono text-xs font-semibold">{affiliate.code}</TableCell>
                  <TableCell className="text-slate-600">{affiliate.city}</TableCell>
                  <TableCell className="font-mono text-xs text-slate-700">{formatPhone(affiliate.phone)}</TableCell>
                  <TableCell className="text-xs">
                    <span className="font-mono font-semibold text-slate-800">{affiliate.pixKey}</span>{" "}
                    <span className="text-[10px] text-slate-400 font-mono">({pixKeyTypeLabels[affiliate.pixType]})</span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={affiliateStatusVariant[affiliate.status]}>
                      {affiliateStatusLabels[affiliate.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-slate-800">
                    {formatCurrency(affiliate.totalEarned)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-semibold text-slate-600">
                    {formatCurrency(affiliate.totalPaid)}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold text-emerald-700">
                    {formatCurrency(affiliate.availableBalance)}
                  </TableCell>
                  <TableCell className="text-right">
                    <AffiliateActionsCell
                      affiliateId={affiliate.id}
                      affiliateName={affiliate.name}
                      phone={affiliate.phone}
                      pixKey={affiliate.pixKey}
                      pixTypeLabel={pixKeyTypeLabels[affiliate.pixType]}
                      status={affiliate.status}
                      totalEarned={affiliate.totalEarned}
                      totalPaid={affiliate.totalPaid}
                      availableBalance={affiliate.availableBalance}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
