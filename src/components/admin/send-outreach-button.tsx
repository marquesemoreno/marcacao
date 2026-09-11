"use client";

import { useState, useTransition } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { generateOutreachDraft, sendOutreachNow } from "@/actions/partner-leads";

const DRAFT_ERROR_MESSAGES = {
  lead_not_found: "Lead não encontrado.",
  ai_unavailable: "IA indisponível no momento — tente de novo em instantes.",
} as const;

const SEND_ERROR_MESSAGES = {
  lead_not_found: "Lead não encontrado.",
  clinic_not_found: "Clínica TIVDC não encontrada.",
  send_failed: "Não foi possível enviar a mensagem pelo WhatsApp.",
} as const;

/** Gera a mensagem de IA e deixa o admin ler (e editar, se quiser) antes de mandar
 * de verdade — nada sai pelo WhatsApp sem essa confirmação explícita. */
export function SendOutreachButton({ leadId }: { leadId: string }) {
  const [isGenerating, startGenerating] = useTransition();
  const [isSending, startSending] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  function handleGenerate() {
    startGenerating(async () => {
      const result = await generateOutreachDraft(leadId);
      if (!result.success) {
        toast.error(DRAFT_ERROR_MESSAGES[result.reason]);
        return;
      }
      setMessage(result.message);
      setOpen(true);
    });
  }

  function handleSend() {
    if (!message.trim()) {
      toast.error("A mensagem não pode ficar vazia.");
      return;
    }
    startSending(async () => {
      const result = await sendOutreachNow(leadId, message);
      if (result.success) {
        toast.success("Mensagem enviada via IA.");
        setOpen(false);
        return;
      }
      toast.error(SEND_ERROR_MESSAGES[result.reason]);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
        {isGenerating ? "Gerando..." : "Enviar agora (IA)"}
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar mensagem</DialogTitle>
          <DialogDescription>
            Gerada pela IA — edite se quiser antes de mandar. Nada é enviado até você confirmar.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          rows={8}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="text-sm"
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={isSending}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSend} disabled={isSending}>
            {isSending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {isSending ? "Enviando..." : "Enviar mensagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
