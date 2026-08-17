"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { approveAndRegisterClinic } from "@/actions/partner-leads";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function ApproveClinicDialog({
  leadId,
  clinicName,
  phone,
  neighborhood,
}: {
  leadId: string;
  clinicName: string;
  phone: string;
  neighborhood: string;
}) {
  const [open, setOpen] = useState(false);
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => approveAndRegisterClinic(leadId, formData), {
      successMessage: `${clinicName} cadastrada como clínica parceira.`,
      errorMessage: "Não foi possível cadastrar a clínica. Confira os campos e tente novamente.",
      onSuccess: () => {
        formRef.current?.reset();
        setOpen(false);
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        size="sm"
        className="gap-1.5 bg-sky-600 text-white hover:bg-sky-700"
        onClick={() => setOpen(true)}
      >
        <CheckCircle2 className="h-4 w-4" />
        Aprovar e Cadastrar Clínica
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Aprovar e cadastrar clínica</DialogTitle>
          <DialogDescription>
            Confirma os dados abaixo (alguns já vieram do lead) para ativar {clinicName} como
            clínica parceira. Isso cria a clínica e marca o lead como &quot;Parceiro&quot;.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label className="text-xs">Razão social</Label>
            <Input name="name" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nome fantasia</Label>
            <Input name="tradeName" className="h-9" defaultValue={clinicName} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CNPJ</Label>
            <Input name="cnpj" placeholder="00.000.000/0000-00" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input name="phone" className="h-9" defaultValue={phone} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp</Label>
            <Input name="whatsapp" className="h-9" defaultValue={phone} />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label className="text-xs">Endereço</Label>
            <Input name="address" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bairro</Label>
            <Input name="neighborhood" className="h-9" defaultValue={neighborhood} required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cidade</Label>
            <Input name="city" className="h-9" defaultValue="Vitória da Conquista" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Comissão (%)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              max="100"
              name="commissionRate"
              defaultValue="15"
              className="h-9"
              required
            />
          </div>
          <DialogFooter className="col-span-2 sm:col-span-3">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Cadastrando..." : "Confirmar e cadastrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
