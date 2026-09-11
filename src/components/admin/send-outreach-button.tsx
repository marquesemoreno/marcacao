"use client";

import { useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { sendOutreachNow } from "@/actions/partner-leads";

/** Dispara a mensagem de IA pra esse lead na hora, sem depender do interruptor
 * automático estar ligado nem esperar o ciclo de ~5min (ver AiOutreachControl). */
export function SendOutreachButton({ leadId }: { leadId: string }) {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      try {
        const result = await sendOutreachNow(leadId);
        if (result.success) {
          toast.success("Mensagem enviada via IA.");
          return;
        }
        const reasonMessages: Record<typeof result.reason, string> = {
          lead_not_found: "Lead não encontrado.",
          clinic_not_found: "Clínica TIVDC não encontrada.",
          ai_unavailable: "IA indisponível no momento — tente de novo em instantes.",
          send_failed: "Não foi possível enviar a mensagem pelo WhatsApp.",
        };
        toast.error(reasonMessages[result.reason]);
      } catch {
        toast.error("Não foi possível enviar a mensagem. Tente novamente.");
      }
    });
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-1.5"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      Enviar agora (IA)
    </Button>
  );
}
