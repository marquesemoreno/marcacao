import { Skeleton } from "@/components/ui/skeleton";

/** Esqueleto genérico de página do painel: título, faixa de cartões e uma lista. */
export function PanelLoading() {
  return (
    <div role="status" aria-label="Carregando" className="space-y-5 p-6">
      <Skeleton className="h-8 w-56" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14" />
        ))}
      </div>
    </div>
  );
}
