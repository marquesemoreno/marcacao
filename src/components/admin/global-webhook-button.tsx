"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { reapplyGlobalWebhook } from "@/actions/admin-whatsapp-instance";

/** Reaplica o webhook da instância global (a das variáveis de ambiente), que não aparece
 * no modal "Instância WhatsApp" de cada clínica. Usado pra aplicar o token de segurança. */
export function GlobalWebhookButton() {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      const result = await reapplyGlobalWebhook();
      if (!result.success) {
        toast.error(result.error);
      } else if (result.withToken) {
        toast.success(`Webhook da instância global (${result.instanceName}) reaplicado com o token de segurança.`);
      } else {
        toast.warning("Webhook global reaplicado, mas sem token: WHATSAPP_WEBHOOK_SECRET não está configurado.");
      }
    } catch {
      toast.error("Erro ao reaplicar o webhook global.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleClick}
      title="Registra de novo o webhook da instância global na Evolution, com o token de segurança. Não derruba a conexão."
      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900 border border-sky-200 dark:border-sky-800 disabled:opacity-50 rounded-xl transition-all"
    >
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
      Reaplicar webhook global
    </button>
  );
}
