import type { AppointmentType, ProcedureCategory } from "@prisma/client";
import { SearchBar } from "@/components/public/search-bar";
import { ResultFilters } from "@/components/public/result-filters";
import { ProcedureResultCard } from "@/components/public/procedure-result-card";
import { searchClinicProcedures } from "@/actions/search";
import { SlidersHorizontal, Building2 } from "lucide-react";

type ProceduresPageProps = {
  searchParams: Promise<{
    q?: string;
    bairro?: string;
    cidade?: string;
    clinica?: string;
    category?: string;
    appointmentType?: string;
    minRating?: string;
    sort?: string;
  }>;
};

export default async function ProceduresCatalogPage({ searchParams }: ProceduresPageProps) {
  const params = await searchParams;

  let results = await searchClinicProcedures({
    query: params.q,
    neighborhood: params.bairro,
    city: params.cidade,
    clinicName: params.clinica,
    category: params.category as ProcedureCategory | undefined,
    appointmentType: params.appointmentType as AppointmentType | undefined,
    minRating: params.minRating ? Number(params.minRating) : undefined,
  });

  if (params.sort === "rating_desc") {
    results = [...results].sort((a, b) => b.clinic.rating - a.clinic.rating);
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8 sm:px-6">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-teal-200/80 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800 uppercase tracking-wider font-mono">
          <Building2 className="size-3.5 text-teal-600" />
          Catálogo Oficial de Saúde
        </div>

        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight sm:text-3xl">
          Consultas, Exames e Procedimentos Credenciados
        </h1>
        <p className="text-sm text-slate-600 leading-relaxed">
          Navegue pelas especialidades e procedimentos credenciados na sua região, consulte horários e solicite atendimento no seu WhatsApp.
        </p>

        <SearchBar defaultValue={params.q} />
        <ResultFilters />
      </div>

      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3 text-xs text-slate-600 font-semibold">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="size-3.5 text-teal-600" />
          <span>
            {results.length} {results.length === 1 ? "procedimento encontrado no catálogo" : "procedimentos encontrados no catálogo"}
          </span>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 py-16 text-center">
          <p className="font-bold text-slate-800 text-base">Nenhum procedimento encontrado</p>
          <p className="text-xs text-slate-500 max-w-md">
            Tente alterar os termos de busca, limpar as abas de categoria ou selecionar outra cidade/bairro.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {results.map((result) => (
            <ProcedureResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </main>
  );
}
