import Link from "next/link";
import { MapPin, Phone, CheckCircle2, ShieldCheck, ArrowRight, MessageCircle, Building2, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/public/rating-stars";
import { prisma } from "@/lib/prisma";
import { buildWhatsAppLink } from "@/lib/format";

type ClinicasPageProps = {
  searchParams: Promise<{
    q?: string;
    cidade?: string;
    bairro?: string;
  }>;
};

export const dynamic = "force-dynamic";

const clinicPhotos = [
  "https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1629909614456-6b1c5c94cecc?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1606318313647-137d1f3b4d3c?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1581982231900-6a1a46b744c9?w=800&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1608979827489-2b855e79debe?w=800&auto=format&fit=crop&q=80",
];

const cityOptions = [
  { value: "", label: "📍 Todas as Cidades" },
  { value: "Vitória da Conquista", label: "Vitória da Conquista" },
  { value: "Barra do Choça", label: "Barra do Choça" },
  { value: "Planalto", label: "Planalto" },
  { value: "Poções", label: "Poções" },
  { value: "Itambé", label: "Itambé" },
];

const neighborhoodOptions = [
  { value: "", label: "📍 Todos os Bairros" },
  { value: "Centro", label: "Centro" },
  { value: "Recreio", label: "Recreio" },
  { value: "Candeias", label: "Candeias" },
  { value: "Alto Maron", label: "Alto Maron" },
];

export default async function ClinicasCredenciadasPage({ searchParams }: ClinicasPageProps) {
  const params = await searchParams;

  // Busca todas as clínicas credenciadas diretamente no banco via Prisma
  const dbClinics = await prisma.clinic.findMany({
    where: {
      active: true,
      ...(params.cidade ? { city: { equals: params.cidade, mode: "insensitive" } } : {}),
      ...(params.bairro ? { neighborhood: { equals: params.bairro, mode: "insensitive" } } : {}),
      ...(params.q
        ? {
            OR: [
              { tradeName: { contains: params.q, mode: "insensitive" } },
              { name: { contains: params.q, mode: "insensitive" } },
              { neighborhood: { contains: params.q, mode: "insensitive" } },
              { city: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { rating: "desc" },
    select: {
      id: true,
      tradeName: true,
      neighborhood: true,
      city: true,
      address: true,
      phone: true,
      rating: true,
      reviewCount: true,
      clinicProcedures: {
        take: 6,
        orderBy: { procedure: { name: "asc" } },
        select: { procedure: { select: { name: true, category: true } } },
      },
    },
  });

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      {/* Header Banner */}
      <div className="mx-auto max-w-3xl text-center space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-emerald-800 font-mono shadow-2xs">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          Rede Conecta Saúde
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight sm:text-4xl">
          Rede de Clínicas e Centros Médicos Credenciados
        </h1>
        <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
          Encontre atendimento particular com valores sob consulta em Vitória da Conquista, Barra do Choça, Planalto e região.
        </p>

        {/* Filter Form */}
        <form className="mt-6 flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2 pt-2">
          <div className="relative flex-1 min-w-[240px] w-full sm:w-auto">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Buscar clínica por nome ou bairro..."
              aria-label="Buscar clínica por nome"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-xs font-bold text-slate-800 shadow-2xs outline-none focus:border-teal-500"
            />
          </div>

          <select
            name="cidade"
            defaultValue={params.cidade ?? ""}
            aria-label="Filtrar por Cidade"
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs outline-none cursor-pointer hover:border-emerald-300 transition-colors w-full sm:w-auto"
          >
            {cityOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            name="bairro"
            defaultValue={params.bairro ?? ""}
            aria-label="Filtrar por Bairro"
            className="h-11 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-800 shadow-2xs outline-none cursor-pointer hover:border-emerald-300 transition-colors w-full sm:w-auto"
          >
            {neighborhoodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <Button type="submit" size="sm" className="h-11 px-6 bg-teal-600 text-white font-bold text-xs rounded-xl shadow-2xs hover:bg-teal-700 w-full sm:w-auto">
            Filtrar Unidades
          </Button>
        </form>
      </div>

      {/* Grid of Clinics */}
      {dbClinics.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
          <p className="font-bold text-slate-800 text-base">Nenhuma clínica encontrada com os filtros selecionados</p>
          <p className="text-xs text-slate-500">Tente buscar por outro termo ou selecione todas as cidades.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {dbClinics.map((clinic, index) => {
            const fullAddress = `${clinic.address}, ${clinic.neighborhood}, ${clinic.city}`;
            const waMessage = `Olá! Vi a ${clinic.tradeName} no Conecta Saúde e gostaria de consultar horários e exames disponíveis.`;
            const waLink = clinic.phone
              ? buildWhatsAppLink(clinic.phone, waMessage)
              : `https://wa.me/?text=${encodeURIComponent(waMessage)}`;

            return (
              <div
                key={clinic.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-emerald-300/60 hover:shadow-xl"
              >
                {/* Photo Header */}
                <div className="relative h-40 w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={clinicPhotos[index % clinicPhotos.length]}
                    alt={clinic.tradeName}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/50 via-transparent to-transparent" />
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                    <Badge variant="outline" className="border-emerald-300 bg-emerald-950/80 text-emerald-300 backdrop-blur-xs font-mono text-[10px] uppercase font-bold">
                      <CheckCircle2 className="size-3 mr-1 text-emerald-400" />
                      Credenciada Oficial
                    </Badge>
                    <RatingStars rating={clinic.rating} reviewCount={clinic.reviewCount} />
                  </div>
                </div>

                <div className="p-5 sm:p-6 space-y-4">
                  {/* Clinic Info */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-lg sm:text-xl group-hover:text-teal-700 transition-colors leading-snug">
                      {clinic.tradeName}
                    </h3>
                    <p className="text-xs text-slate-600 flex items-start gap-1.5 mt-1.5 font-medium leading-relaxed">
                      <MapPin className="size-4 text-teal-600 shrink-0 mt-0.5" />
                      <span>{fullAddress}</span>
                    </p>
                    {clinic.phone && (
                      <p className="text-xs text-slate-500 flex items-center gap-1.5 mt-1 font-mono">
                        <Phone className="size-3.5 text-teal-600 shrink-0" />
                        <span>{clinic.phone}</span>
                      </p>
                    )}
                  </div>

                  {/* Main Specialties Served */}
                  {clinic.clinicProcedures && clinic.clinicProcedures.length > 0 && (
                    <div className="border-t border-slate-100 pt-3">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 mb-2">
                        Especialidades Atendidas:
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {clinic.clinicProcedures.slice(0, 5).map(({ procedure }) => (
                          <Badge
                            key={procedure.name}
                            variant="outline"
                            className="border-slate-200 bg-slate-50 text-slate-700 font-semibold text-[11px] px-2.5 py-0.5 rounded-lg transition-colors group-hover:bg-teal-50 group-hover:border-teal-200"
                          >
                            {procedure.name}
                          </Badge>
                        ))}
                        {clinic.clinicProcedures.length > 5 && (
                          <Badge
                            variant="outline"
                            className="border-dashed border-slate-300 text-slate-500 text-[10px] px-2 py-0.5 rounded-lg"
                          >
                            +{clinic.clinicProcedures.length - 5} mais
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="px-5 pb-5 pt-1 flex flex-col gap-2">
                  <Button
                    render={<Link href={`/procedimentos?clinica=${encodeURIComponent(clinic.tradeName)}`} />}
                    nativeButton={false}
                    className="h-11 w-full bg-teal-600 text-white font-bold rounded-xl shadow-2xs hover:bg-teal-700 transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    <Building2 className="size-3.5" />
                    <span>Ver Procedimentos</span>
                    <ArrowRight className="size-3.5" />
                  </Button>

                  <Button
                    render={
                      <a href={waLink} target="_blank" rel="noopener noreferrer" />
                    }
                    nativeButton={false}
                    variant="outline"
                    className="h-10 w-full border-emerald-300 text-emerald-800 bg-emerald-50/60 font-bold rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center gap-1.5 text-xs"
                  >
                    <MessageCircle className="size-3.5 text-emerald-600" />
                    <span>Falar no WhatsApp</span>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
