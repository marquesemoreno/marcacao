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
        await sendOutreachNow(leadId);
        toast.success("Mensagem enviada via IA.");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
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
