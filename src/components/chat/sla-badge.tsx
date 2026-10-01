import { Clock } from "lucide-react";
import type { SlaInfo } from "@/lib/sla-calculator";

const VARIANT_CLASSES: Record<SlaInfo["variant"], string> = {
  normal: "bg-slate-100 text-slate-600 border-slate-200",
  warning: "bg-amber-50 text-amber-700 border-amber-200",
  critical: "bg-rose-50 text-rose-700 border-rose-200 font-semibold",
};

/** Tempo de espera útil (dentro do expediente, ver src/lib/sla-calculator.ts) desde a
 * última mensagem do paciente ainda sem resposta — some sozinho quando shouldDisplay
 * é false (já respondida ou conversa finalizada). */
export function SLABadge({ sla }: { sla: SlaInfo }) {
  if (!sla.shouldDisplay) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${VARIANT_CLASSES[sla.variant]}`}
      title={`Aguardando há ${sla.formattedTime} de expediente`}
    >
      <Clock className="w-3 h-3" />
      {sla.formattedTime}
    </span>
  );
}
