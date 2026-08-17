import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getKpis } from "@/actions/admin";
import { listClinics } from "@/actions/admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminDashboardPage() {
  const [kpis, clinics] = await Promise.all([getKpis(), listClinics()]);
  const activeClinics = clinics.filter((clinic) => clinic.active).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Visão Geral</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Clínicas Ativas</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{activeClinics}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total de Pedidos</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">{kpis.totalOrders}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Taxa de Conversão</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {kpis.conversionRate.toFixed(1)}%
          </CardContent>
        </Card>
      </div>
      <p className="text-xs text-muted-foreground">
        Taxa de conversão = agendamentos confirmados ou concluídos ÷ total de pedidos.
      </p>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Procedimentos mais buscados</h2>
        {kpis.topProcedures.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum agendamento registrado ainda.</p>
        ) : (
          <Card>
            <CardContent className="divide-y p-0">
              {kpis.topProcedures.map((procedure, index) => (
                <div key={procedure.name} className="flex items-center justify-between px-4 py-3">
                  <span className="text-sm">
                    <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                    {procedure.name}
                  </span>
                  <span className="text-sm font-semibold">{procedure.count}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
