"use client";

import { useEffect, useState } from "react";
import { Wrench, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getMspOutreachStatus, setMspOutreachEnabled } from "@/actions/msp-leads";

type Status = { enabled: boolean; nextRunAt: string | Date; pendingCount: number };

/** Painel de controle do primeiro contato automático pros leads NEW de MSP (ver
 * msp-lead-outreach.ts). Fica sempre visível em /admin/leads-msp — nunca ativa
 * sozinho, só quando o admin aperta o botão aqui. */
export function MspOutreachControl() {
  const [status, setStatus] = useState<Status | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  async function refresh() {
    const result = await getMspOutreachStatus();
    setStatus(result);
  }

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleToggle() {
    if (!status) return;
    setIsToggling(true);
    try {
      await setMspOutreachEnabled(!status.enabled);
      await refresh();
      toast.success(
        status.enabled
          ? "Contato automático desligado."
          : "Contato automático ligado — a primeira mensagem sai em até 1 minuto (dentro do horário 09h-12h/14h-18h)."
      );
    } finally {
      setIsToggling(false);
    }
  }

  if (!status) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${status.enabled ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400" : "bg-slate-100 dark:bg-slate-800 text-slate-400"}`}>
          <Wrench className="w-4.5 h-4.5" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Primeiro contato automático
          </p>
          <p className="text-xs text-muted-foreground">
            {status.enabled
              ? `Ligado — a cada ~5min (com variação), pela instância WhatsApp da TIVDC, só entre 09h-12h/14h-18h. ${status.pendingCount} lead(s) na fila.`
              : `Desligado. ${status.pendingCount} lead(s) novos aguardando.`}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={handleToggle}
        disabled={isToggling || (status.pendingCount === 0 && !status.enabled)}
        title={status.pendingCount === 0 && !status.enabled ? "Nenhum lead novo pra contatar" : undefined}
        className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 ${
          status.enabled
            ? "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60"
            : "bg-emerald-600 text-white hover:bg-emerald-700"
        }`}
      >
        {isToggling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
        {status.enabled ? "Desligar" : "Ligar"}
      </button>
    </div>
  );
}
