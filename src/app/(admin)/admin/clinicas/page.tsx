import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { listClinics } from "@/actions/admin";
import { UpdateClinicForm } from "@/components/admin/update-clinic-form";
import { CreateClinicForm } from "@/components/admin/create-clinic-form";
import { toPlainClinic } from "@/lib/serialize";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminClinicsPage() {
  const clinics = await listClinics();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">Clínicas Parceiras</h1>

      <div className="space-y-3">
        {clinics.map((clinic) => (
          <Card key={clinic.id}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                {clinic.tradeName}
                <Badge variant={clinic.active ? "default" : "secondary"}>
                  {clinic.active ? "Ativa" : "Inativa"}
                </Badge>
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {clinic.cnpj} · {clinic.neighborhood}, {clinic.city}
              </p>
            </CardHeader>
            <CardContent>
              <UpdateClinicForm clinic={toPlainClinic(clinic)} />
            </CardContent>
          </Card>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cadastrar nova clínica</h2>
        <CreateClinicForm />
      </section>
    </div>
  );
}
