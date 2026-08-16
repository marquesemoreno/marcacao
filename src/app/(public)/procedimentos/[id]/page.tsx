import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { RatingStars } from "@/components/public/rating-stars";
import { BookingDialog } from "@/components/public/booking-dialog";
import { getClinicProcedureDetail } from "@/actions/search";
import { appointmentTypeLabels, categoryLabels, formatCurrency } from "@/lib/format";
import { toPlainClinicProcedure } from "@/lib/serialize";

type DetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProcedureDetailPage({ params }: DetailPageProps) {
  const { id } = await params;
  const result = await getClinicProcedureDetail(id);

  if (!result) {
    notFound();
  }

  const { clinic, procedure, price, promotionalPrice, appointmentType } = result;
  const hasPromo = promotionalPrice != null;
  const fullAddress = `${clinic.address}, ${clinic.neighborhood}, ${clinic.city}`;
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(fullAddress)}&output=embed`;

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6 pb-28">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold leading-tight">{procedure.name}</h1>
          <p className="text-muted-foreground">{clinic.tradeName}</p>
        </div>
        <Badge variant="secondary" className="shrink-0">
          {categoryLabels[procedure.category]}
        </Badge>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <RatingStars rating={clinic.rating} reviewCount={clinic.reviewCount} />
        <Badge variant="outline">{appointmentTypeLabels[appointmentType]}</Badge>
      </div>

      <Card>
        <CardContent className="flex items-baseline gap-2 p-4">
          {hasPromo && (
            <span className="text-sm text-muted-foreground line-through">
              {formatCurrency(price.toString())}
            </span>
          )}
          <span className="text-2xl font-bold text-primary">
            {formatCurrency((promotionalPrice ?? price).toString())}
          </span>
        </CardContent>
      </Card>

      {procedure.description && (
        <section>
          <h2 className="font-semibold">Sobre o procedimento</h2>
          <p className="text-sm text-muted-foreground">{procedure.description}</p>
        </section>
      )}

      {procedure.preparationInstructions && (
        <section className="rounded-lg border bg-amber-50 p-4 dark:bg-amber-950/20">
          <h2 className="font-semibold">Instruções de preparo</h2>
          <p className="text-sm text-muted-foreground">{procedure.preparationInstructions}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">Local de atendimento</h2>
        <div className="flex items-start gap-2 text-sm">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <span>{fullAddress}</span>
        </div>
        {clinic.phone && (
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span>{clinic.phone}</span>
          </div>
        )}
        <div className="overflow-hidden rounded-lg border">
          <iframe
            src={mapSrc}
            title={`Mapa de ${clinic.tradeName}`}
            className="h-48 w-full"
            loading="lazy"
          />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4">
        <div className="mx-auto max-w-2xl">
          <BookingDialog clinicProcedure={toPlainClinicProcedure(result)} />
        </div>
      </div>
    </main>
  );
}
