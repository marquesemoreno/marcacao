"use client";

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { createPartnerLeadManually } from "@/actions/partner-leads";
import { useActionFeedback } from "@/hooks/use-action-feedback";

/** Cadastro manual de lead — pra colocar na fila de contato via IA leads que o
 * admin já tem de fontes fora do formulário público (ver AiOutreachControl). */
export function AddLeadDialog() {
  const [open, setOpen] = useState(false);
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      () =>
        createPartnerLeadManually({
          clinicName: String(formData.get("clinicName") || ""),
          contactName: String(formData.get("contactName") || ""),
          phone: String(formData.get("phone") || ""),
          email: String(formData.get("email") || ""),
          neighborhood: String(formData.get("neighborhood") || ""),
          specialties: String(formData.get("specialties") || ""),
          notes: String(formData.get("notes") || ""),
        }),
      {
        successMessage: "Lead adicionado.",
        errorMessage: "Não foi possível adicionar o lead. Confira os campos.",
        onSuccess: () => {
          formRef.current?.reset();
          setOpen(false);
        },
      }
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Adicionar Lead
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Adicionar lead manualmente</DialogTitle>
          <DialogDescription>
            Pra leads que você já tem de outra fonte (indicação, evento etc.) e quer colocar na
            fila de contato via IA.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Clínica/consultório</Label>
            <Input name="clinicName" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nome do contato (opcional)</Label>
            <Input name="contactName" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone/WhatsApp</Label>
            <Input name="phone" placeholder="77999998888" className="h-9" required />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">E-mail (opcional)</Label>
            <Input name="email" type="email" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bairro/região</Label>
            <Input name="neighborhood" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Especialidades/exames</Label>
            <Input name="specialties" className="h-9" required />
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs">Observações (opcional)</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Adicionando..." : "Adicionar lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
