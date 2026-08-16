import Link from "next/link";
import type { ProcedureCategory } from "@prisma/client";
import { categoryLabels } from "@/lib/format";

const categories: ProcedureCategory[] = ["CONSULTATION", "EXAM", "SURGERY"];

export function CategoryChips() {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {categories.map((category) => (
        <Link
          key={category}
          href={`/buscar?category=${category}`}
          className="shrink-0 rounded-full border bg-card px-4 py-2 text-sm font-medium hover:bg-accent"
        >
          {categoryLabels[category]}
        </Link>
      ))}
    </div>
  );
}
