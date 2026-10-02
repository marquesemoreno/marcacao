import { Clock } from "lucide-react";
import { SLA_CRITICAL_MINUTES, SLA_WARNING_MINUTES, type SlaInfo } from "@/lib/sla-calculator";

/** Neutro dentro do SLA; âmbar/vermelho só quando passa de 15/60 min de expediente (P4). */
const VARIANT_CLASSES: Record<SlaInfo["variant"], string> = {
  normal: "text-slate-500 dark:text-slate-400",
  warning: "text-amber-700 dark:text-amber-400 font-semibold",
  critical: "text-rose-700 dark:text-rose-400 font-semibold",
};

/** "Aguardando há X" — tempo real desde a 1ª mensagem do paciente ainda sem resposta
 * (ver getSlaInfo em src/lib/sla-calculator.ts). Some quando a última mensagem é da
 * clínica ou a conversa está finalizada. */
export function SLABadge({ sla }: { sla: SlaInfo }) {
  if (!sla.shouldDisplay) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs whitespace-nowrap ${VARIANT_CLASSES[sla.variant]}`}
      title={`Paciente aguardando resposta há ${sla.formattedTime}. Fica âmbar após ${SLA_WARNING_MINUTES} min e vermelho após ${SLA_CRITICAL_MINUTES} min de expediente.`}
    >
      <Clock className="w-3 h-3" />
      Aguardando há {sla.formattedTime}
    </span>
  );
}
