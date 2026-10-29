import type { ReactNode } from "react";

/** Caixa "como chega para o paciente" das campanhas — a mesma no formulário (WhatsApp, modelo
 * da API oficial, SMS, e-mail) e na confirmação de início. */
export function BroadcastPreview({ label, children, tall = false }: { label?: string; children: ReactNode; tall?: boolean }) {
  return (
    <div>
      {label && <p className="text-xs font-medium text-slate-600 dark:text-slate-400">{label}</p>}
      <div
        className={`mt-1 ${tall ? "max-h-64" : "max-h-60"} overflow-y-auto whitespace-pre-wrap rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-sm text-emerald-950 dark:text-slate-100`}
      >
        {children}
      </div>
    </div>
  );
}
