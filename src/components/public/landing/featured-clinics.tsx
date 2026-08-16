import Link from "next/link";
import { Building2, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/public/rating-stars";
import type { getFeaturedClinics } from "@/actions/search";

type FeaturedClinic = Awaited<ReturnType<typeof getFeaturedClinics>>[number];

export function FeaturedClinics({ clinics }: { clinics: FeaturedClinic[] }) {
  if (clinics.length === 0) return null;

  return (
    <section id="clinicas" className="bg-white">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Clínicas em destaque</h2>
          <p className="mt-3 text-slate-600">As parceiras mais bem avaliadas na plataforma.</p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic) => (
            <div
              key={clinic.id}
              className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                  <Building2 className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">{clinic.tradeName}</p>
                  <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3" />
                    {clinic.neighborhood} · {clinic.city}
                  </span>
                </div>
              </div>

              <RatingStars rating={clinic.rating} reviewCount={clinic.reviewCount} />

              {clinic.clinicProcedures.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {clinic.clinicProcedures.map(({ procedure }) => (
                    <Badge key={procedure.name} variant="outline" className="font-normal text-slate-600">
                      {procedure.name}
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                render={<Link href={`/buscar?q=${encodeURIComponent(clinic.tradeName)}`} />}
                nativeButton={false}
                className="mt-auto h-11 w-full bg-sky-600 text-white hover:bg-sky-700"
              >
                Ver Horários e Agendar
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
