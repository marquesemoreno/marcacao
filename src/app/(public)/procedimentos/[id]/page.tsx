import { notFound } from "next/navigation";
import { MapPin, Phone } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
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
  const numPrice = promotionalPrice != null ? Number(promotionalPrice) : Number(price);
  const isSobConsulta = !numPrice || numPrice <= 0;
  const hasPromo = promotionalPrice != null && Number(promotionalPrice) > 0;
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
        {isSobConsulta && (
          <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-bold">
            💬 Valor sob consulta
          </Badge>
        )}
      </div>

      <Card>
        <CardContent className="flex flex-col gap-1 p-4">
          {isSobConsulta ? (
            <div>
              <p className="text-xl font-extrabold text-teal-800">Valor sob consulta</p>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                <WhatsAppIcon className="size-3.5 text-emerald-600" />
                Negociado diretamente com a clínica via WhatsApp ou recepção.
              </p>
            </div>
          ) : (
            <div className="flex items-baseline gap-2">
              {hasPromo && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatCurrency(price.toString())}
                </span>
              )}
              <span className="text-2xl font-bold text-teal-700 font-mono">
                {formatCurrency(numPrice.toString())}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {procedure.description && (
        <section className="space-y-1">
          <h2 className="font-semibold text-slate-900">Sobre o procedimento</h2>
          <p className="text-sm text-slate-600 leading-relaxed">{procedure.description}</p>
        </section>
      )}

      {procedure.preparationInstructions && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-semibold text-amber-950">Instruções de preparo</h2>
          <p className="text-sm text-amber-900 leading-relaxed">{procedure.preparationInstructions}</p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold text-slate-900">Local de atendimento</h2>
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
          <span>{fullAddress}</span>
        </div>
        {clinic.phone && (
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <Phone className="h-4 w-4 shrink-0 text-teal-600" />
            <span>{clinic.phone}</span>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <iframe
            src={mapSrc}
            title={`Mapa de ${clinic.tradeName}`}
            className="h-48 w-full"
            loading="lazy"
          />
        </div>
      </section>

      <div className="fixed inset-x-0 bottom-0 border-t bg-background p-4 shadow-lg z-30">
        <div className="mx-auto max-w-2xl">
          <BookingDialog clinicProcedure={toPlainClinicProcedure(result)} />
        </div>
      </div>
    </main>
  );
}
