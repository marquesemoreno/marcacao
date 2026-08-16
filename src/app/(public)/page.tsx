import { SearchBar } from "@/components/public/search-bar";
import { CategoryChips } from "@/components/public/category-chips";
import { ProcedureResultCard } from "@/components/public/procedure-result-card";
import { searchClinicProcedures } from "@/actions/search";

// Preços/avaliações mudam a qualquer momento — evita que a home fique
// congelada com dados do instante do build (e evita build do Docker
// depender de um banco acessível/populado nesse momento, ver Dockerfile).
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const featured = await searchClinicProcedures({ sort: "rating_desc" });

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 px-4 py-8">
      <section className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">
          Agende sua consulta ou exame em minutos
        </h1>
        <p className="text-muted-foreground">
          Compare preços e horários nas melhores clínicas parceiras perto de você.
        </p>
        <SearchBar />
        <CategoryChips />
      </section>

      {featured.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Bem avaliados perto de você</h2>
          <div className="flex flex-col gap-3">
            {featured.slice(0, 6).map((result) => (
              <ProcedureResultCard key={result.id} result={result} />
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
