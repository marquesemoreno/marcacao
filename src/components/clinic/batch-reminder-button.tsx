"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { sendBatchReminders } from "@/actions/reminders";
import { toast } from "sonner";

export function BatchReminderButton() {
  const [isPending, setIsPending] = useState(false);

  async function handleBatchReminders() {
    setIsPending(true);
    try {
      const res = await sendBatchReminders();
      if (res.success) {
        toast.success(`Disparo concluído: ${res.count} lembrete(s) enviado(s) via WhatsApp!`);
      } else {
        toast.error("Não foi possível enviar os lembretes.");
      }
    } catch {
      toast.error("Erro ao processar disparo em lote.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={handleBatchReminders}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-2xs active:scale-95 disabled:opacity-60"
      title="Disparar lembretes WhatsApp para todas as consultas pendentes"
    >
      <Send className="w-3.5 h-3.5" />
      <span>{isPending ? "Disparando Lembretes..." : "⚡ Disparar Lembretes em Lote"}</span>
    </button>
  );
}
