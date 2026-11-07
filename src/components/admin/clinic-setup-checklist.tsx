import { Check, Circle } from "lucide-react";
import type { clinicSetupChecklist } from "@/lib/clinic-setup";

/** "Pronta para usar 3/5" no cartão da clínica, com a lista do que falta ao abrir. */
export function ClinicSetupChecklist({ setup }: { setup: ReturnType<typeof clinicSetupChecklist> }) {
  const optionalDone = setup.items.filter((i) => !i.required && i.done).length;
  const optionalTotal = setup.items.length - setup.required;
  return (
    <details className="group rounded-xl bg-slate-100 dark:bg-slate-800/60 px-3 py-2 text-xs">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
            setup.ready
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
              : "bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
          }`}
        >
          {setup.ready ? "Pronta para usar" : `Configuração ${setup.done}/${setup.required}`}
        </span>
        <span className="text-slate-500 dark:text-slate-400">
          Extras {optionalDone}/{optionalTotal} <span className="group-open:hidden">· ver</span>
        </span>
      </summary>
      <ul className="mt-2 space-y-1">
        {setup.items.map((i) => (
          <li key={i.key} className="flex items-start gap-2" title={i.hint}>
            {i.done ? (
              <Check className="mt-0.5 size-3.5 shrink-0 text-emerald-600" aria-label="feito" />
            ) : (
              <Circle className={`mt-0.5 size-3.5 shrink-0 ${i.required ? "text-amber-500" : "text-slate-400"}`} aria-label="pendente" />
            )}
            <span className={i.done ? "text-slate-500 dark:text-slate-400" : "text-slate-800 dark:text-slate-200"}>
              {i.label}
              {!i.required && <span className="text-slate-400"> (opcional)</span>}
              {!i.done && <span className="block text-[11px] text-slate-500">{i.hint}</span>}
            </span>
          </li>
        ))}
      </ul>
    </details>
  );
}
