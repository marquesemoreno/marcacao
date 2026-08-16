import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RatingStars } from "@/components/public/rating-stars";
import { appointmentTypeLabels, categoryLabels, formatCurrency } from "@/lib/format";

export type ClinicProcedureResult = Prisma.ClinicProcedureGetPayload<{
  include: { clinic: true; procedure: { include: { specialty: true } } };
}>;

export function ProcedureResultCard({ result }: { result: ClinicProcedureResult }) {
  const { clinic, procedure, price, promotionalPrice, appointmentType } = result;
  const hasPromo = promotionalPrice != null;

  return (
    <Link href={`/procedimentos/${result.id}`}>
      <Card className="transition-colors hover:border-primary">
        <CardContent className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold leading-tight">{procedure.name}</p>
              <p className="text-sm text-muted-foreground">
                {clinic.tradeName} · {clinic.neighborhood}, {clinic.city}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {categoryLabels[procedure.category]}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <RatingStars rating={clinic.rating} reviewCount={clinic.reviewCount} />
            <Badge variant="outline">{appointmentTypeLabels[appointmentType]}</Badge>
          </div>

          <div className="flex items-baseline gap-2 pt-1">
            {hasPromo && (
              <span className="text-sm text-muted-foreground line-through">
                {formatCurrency(price.toString())}
              </span>
            )}
            <span className="text-lg font-bold text-primary">
              {formatCurrency((promotionalPrice ?? price).toString())}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
