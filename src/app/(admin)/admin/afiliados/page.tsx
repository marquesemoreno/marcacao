import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getAffiliates } from "@/actions/affiliates";
import {
  formatCurrency,
  formatPhone,
  affiliateStatusLabels,
  affiliateStatusVariant,
  pixKeyTypeLabels,
} from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminAffiliatesPage() {
  const affiliates = await getAffiliates();
  const totalEarned = affiliates.reduce((sum, affiliate) => sum + Number(affiliate.totalEarned), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Marcadores / Afiliados</h1>
        <p className="text-sm text-muted-foreground">
          Cadastros do programa de indicação em <code>/afiliados</code> — use a chave PIX abaixo para o
          acerto financeiro de cada marcador.
        </p>
      </div>

      {affiliates.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum marcador cadastrado ainda.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Marcador</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Cidade</TableHead>
                <TableHead>WhatsApp</TableHead>
                <TableHead>Chave PIX</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total Gerado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {affiliates.map((affiliate) => (
                <TableRow key={affiliate.id}>
                  <TableCell className="font-medium">{affiliate.name}</TableCell>
                  <TableCell className="font-mono text-xs">{affiliate.code}</TableCell>
                  <TableCell>{affiliate.city}</TableCell>
                  <TableCell>{formatPhone(affiliate.phone)}</TableCell>
                  <TableCell>
                    {affiliate.pixKey}{" "}
                    <span className="text-xs text-muted-foreground">
                      ({pixKeyTypeLabels[affiliate.pixType]})
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={affiliateStatusVariant[affiliate.status]}>
                      {affiliateStatusLabels[affiliate.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(Number(affiliate.totalEarned))}</TableCell>
                </TableRow>
              ))}
              <TableRow className="font-semibold">
                <TableCell colSpan={6}>Total</TableCell>
                <TableCell>{formatCurrency(totalEarned)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
