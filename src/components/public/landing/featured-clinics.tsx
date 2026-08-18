import Link from "next/link";
import { MapPin, CheckCircle2, ShieldCheck, ArrowRight, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/public/rating-stars";
import type { getFeaturedClinics } from "@/actions/search";

type FeaturedClinic = Awaited<ReturnType<typeof getFeaturedClinics>>[number];

const clinicPhotos = [
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1629909614456-6b1c5c94cecc?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1606318313647-137d1f3b4d3c?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1581982231900-6a1a46b744c9?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1608979827489-2b855e79debe?w=800&auto=format&fit=crop&q=80",
];

export function FeaturedClinics({ clinics }: { clinics: FeaturedClinic[] }) {
  if (!clinics || clinics.length === 0) return null;

  return (
    <section id="clinicas" className="relative bg-slate-50/70 py-16 sm:py-24 border-t border-b border-slate-200/70">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="mx-auto max-w-2xl text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-emerald-800 shadow-2xs font-mono">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Rede Credenciada por Região</span>
          </div>

          <h2 className="mt-4 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
            Clínicas e centros de diagnóstico credenciados
          </h2>
          <p className="mt-3 text-base sm:text-lg text-slate-600 font-normal leading-relaxed">
            Selecione uma clínica para visualizar o catálogo completo de procedimentos e consultar horários.
          </p>
        </div>

        {/* Clinics Grid */}
        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {clinics.map((clinic, index) => (
            <div
              key={clinic.id}
              className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300/60 hover:shadow-xl"
            >
              {/* Photo Header */}
              <div className="relative h-36 w-full overflow-hidden bg-slate-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clinicPhotos[index % clinicPhotos.length]}
                  alt={clinic.tradeName}
                  loading="lazy"
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/40 via-transparent to-transparent" />
              </div>

              <div className="p-6">
                {/* Clinic Header: Nome + Verified */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-slate-900 text-lg group-hover:text-teal-700 transition-colors">
                      {clinic.tradeName}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-500 font-medium">
                      <MapPin className="h-3.5 w-3.5 text-teal-600 shrink-0" />
                      <span className="truncate">
                        {clinic.neighborhood} · {clinic.city}
                      </span>
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200/60 shrink-0 font-mono">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Verificada
                  </span>
                </div>

                {/* Rating & Under Consultation Badge */}
                <div className="mt-4 flex items-center justify-between border-y border-slate-100 py-3">
                  <RatingStars rating={clinic.rating} reviewCount={clinic.reviewCount} />

                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg">
                    <MessageCircle className="h-3 w-3 text-emerald-600" />
                    Valor sob consulta
                  </span>
                </div>

                {/* Procedures List */}
                {clinic.clinicProcedures && clinic.clinicProcedures.length > 0 && (
                  <div className="mt-4">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2 font-mono">
                      Procedimentos em destaque:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {clinic.clinicProcedures.slice(0, 4).map(({ procedure }) => (
                        <Badge
                          key={procedure.name}
                          variant="outline"
                          className="border-slate-200/80 bg-slate-50 text-slate-700 font-medium text-xs px-2.5 py-0.5 rounded-lg transition-colors group-hover:bg-teal-50/50 group-hover:border-teal-200"
                        >
                          {procedure.name}
                        </Badge>
                      ))}
                      {clinic.clinicProcedures.length > 4 && (
                        <Badge
                          variant="outline"
                          className="border-dashed border-slate-300 text-slate-500 text-xs px-2 py-0.5 rounded-lg"
                        >
                          +{clinic.clinicProcedures.length - 4} mais
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Action Button */}
              <div className="px-6 pb-6 pt-2">
                <Button
                  render={<Link href={`/buscar?q=${encodeURIComponent(clinic.tradeName)}`} />}
                  nativeButton={false}
                  className="group/btn h-12 w-full bg-teal-600 text-white font-bold rounded-2xl shadow-sm hover:bg-teal-700 hover:shadow-md transition-all flex items-center justify-center gap-2 text-sm"
                >
                  <span>Ver Exames desta Clínica</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
