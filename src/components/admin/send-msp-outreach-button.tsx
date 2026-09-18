"use client";

import { useState, useTransition } from "react";
import { Send, Loader2 } from "lucide-react";
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
import { getMspOutreachDraft, sendMspOutreachNow } from "@/actions/msp-leads";

const SEND_ERROR_MESSAGES = {
  lead_not_found: "Lead não encontrado.",
  clinic_not_found: "Clínica TIVDC não encontrada.",
  send_failed: "Não foi possível enviar a mensagem pelo WhatsApp.",
} as const;

/** Monta o texto fixo do primeiro contato (sem IA — ver buildMspOutreachDraft) e
 * deixa o admin ler/editar antes de mandar de verdade. */
export function SendMspOutreachButton({ leadId }: { leadId: string }) {
  const [isLoadingDraft, startLoadingDraft] = useTransition();
  const [isSending, startSending] = useTransition();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  function handleOpen() {
    startLoadingDraft(async () => {
      const result = await getMspOutreachDraft(leadId);
      if (!result.success) {
        toast.error("Lead não encontrado.");
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
      const result = await sendMspOutreachNow(leadId, message);
      if (result.success) {
        toast.success("Mensagem enviada.");
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
        onClick={handleOpen}
        disabled={isLoadingDraft}
      >
        {isLoadingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar agora
      </Button>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Revisar mensagem</DialogTitle>
          <DialogDescription>
            Texto fixo do script de abordagem — edite se quiser antes de mandar. Nada é enviado
            até você confirmar.
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
