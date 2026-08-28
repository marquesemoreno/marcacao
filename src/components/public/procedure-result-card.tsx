import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RatingStars } from "@/components/public/rating-stars";
import { appointmentTypeLabels, categoryLabels, formatCurrency } from "@/lib/format";
import { MapPin, FileText, ArrowRight } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";

export type ClinicProcedureResult = Prisma.ClinicProcedureGetPayload<{
  include: { clinic: true; procedure: { include: { specialty: true } } };
}>;

export function ProcedureResultCard({ result }: { result: ClinicProcedureResult }) {
  const { clinic, procedure, price, promotionalPrice, appointmentType } = result;
  const numPrice = promotionalPrice != null ? Number(promotionalPrice) : Number(price);
  const isSobConsulta = !numPrice || numPrice <= 0;
  const hasPromo = promotionalPrice != null && Number(promotionalPrice) > 0;

  return (
    <Link href={`/procedimentos/${result.id}`}>
      <div className="group rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-800 font-mono text-[10px] uppercase font-bold">
                {categoryLabels[procedure.category]}
              </Badge>
              {procedure.tussCode && (
                <span className="text-[10px] font-mono font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  TUSS: {procedure.tussCode}
                </span>
              )}
              <Badge variant="outline" className="border-slate-200 text-slate-600 text-[10px]">
                {appointmentTypeLabels[appointmentType]}
              </Badge>

              {isSobConsulta && (
                <Badge variant="outline" className="border-emerald-300 bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                  💬 Valor sob consulta
                </Badge>
              )}
            </div>

            <div>
              <h3 className="font-bold text-slate-900 text-base sm:text-lg group-hover:text-teal-700 transition-colors leading-snug">
                {procedure.name}
              </h3>
              <p className="text-xs text-slate-600 flex items-center gap-1.5 mt-0.5 font-medium">
                <MapPin className="size-3.5 text-teal-600 shrink-0" />
                <span>{clinic.tradeName}</span>
                <span className="text-slate-300">•</span>
                <span>{clinic.neighborhood}, {clinic.city}</span>
              </p>
            </div>

            <div className="flex items-center gap-3 pt-0.5">
              <RatingStars rating={clinic.rating} reviewCount={clinic.reviewCount} />
              
              {procedure.preparationInstructions && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                  <FileText className="size-3 text-amber-600" />
                  {procedure.preparationInstructions}
                </span>
              )}
            </div>
          </div>

          <div className="flex sm:flex-col items-center sm:items-end justify-between border-t sm:border-t-0 border-slate-100 pt-3 sm:pt-0 shrink-0 gap-2">
            <div className="text-left sm:text-right">
              {isSobConsulta ? (
                <div>
                  <p className="text-base sm:text-lg font-extrabold text-teal-800 font-sans">
                    Sob consulta
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Negociação no WhatsApp</p>
                </div>
              ) : (
                <div>
                  {hasPromo && (
                    <p className="text-xs text-slate-400 line-through font-mono">
                      {formatCurrency(price.toString())}
                    </p>
                  )}
                  <p className="text-lg sm:text-xl font-extrabold text-teal-700 font-mono">
                    {formatCurrency(numPrice.toString())}
                  </p>
                  <p className="text-[10px] text-slate-500 font-medium">Pagamento no balcão</p>
                </div>
              )}
            </div>

            <Button
              size="sm"
              className={`h-10 px-5 font-bold text-xs rounded-xl shadow-2xs gap-1.5 transition-all ${
                isSobConsulta
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-teal-600 hover:bg-teal-700 text-white"
              }`}
            >
              {isSobConsulta ? (
                <>
                  <WhatsAppIcon className="size-3.5" />
                  <span>Consultar no WhatsApp</span>
                </>
              ) : (
                <>
                  <span>Agendar</span>
                  <ArrowRight className="size-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </Link>
  );
}
