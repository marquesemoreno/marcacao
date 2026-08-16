import type { AppointmentType, ProcedureCategory } from "@prisma/client";
import { SearchBar } from "@/components/public/search-bar";
import { ResultFilters } from "@/components/public/result-filters";
import { ProcedureResultCard } from "@/components/public/procedure-result-card";
import { searchClinicProcedures } from "@/actions/search";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    appointmentType?: string;
    maxPrice?: string;
    minRating?: string;
  }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;

  const results = await searchClinicProcedures({
    query: params.q,
    category: params.category as ProcedureCategory | undefined,
    appointmentType: params.appointmentType as AppointmentType | undefined,
    maxPrice: params.maxPrice ? Number(params.maxPrice) : undefined,
    minRating: params.minRating ? Number(params.minRating) : undefined,
  });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-6">
      <SearchBar defaultValue={params.q} />
      <ResultFilters />

      <p className="text-sm text-muted-foreground">
        {results.length} {results.length === 1 ? "resultado encontrado" : "resultados encontrados"}
      </p>

      {results.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <p className="font-medium">Nenhum resultado encontrado</p>
          <p className="text-sm text-muted-foreground">
            Tente buscar por outra especialidade, exame, clínica ou bairro.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {results.map((result) => (
            <ProcedureResultCard key={result.id} result={result} />
          ))}
        </div>
      )}
    </main>
  );
}
