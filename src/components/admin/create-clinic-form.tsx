"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { createClinic } from "@/actions/admin";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function CreateClinicForm() {
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(() => createClinic(formData), {
      successMessage: "Clínica cadastrada com sucesso.",
      errorMessage: "Não foi possível cadastrar a clínica. Confira os campos e tente novamente.",
      onSuccess: () => formRef.current?.reset(),
    });
  }

  return (
    <Card>
      <CardContent className="p-4">
        <form ref={formRef} onSubmit={handleSubmit} className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label className="text-xs">Razão social</Label>
            <Input name="name" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Nome fantasia</Label>
            <Input name="tradeName" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">CNPJ</Label>
            <Input name="cnpj" placeholder="00.000.000/0000-00" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Telefone</Label>
            <Input name="phone" className="h-9" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">WhatsApp</Label>
            <Input name="whatsapp" className="h-9" />
          </div>
          <div className="col-span-2 space-y-1 sm:col-span-1">
            <Label className="text-xs">Endereço</Label>
            <Input name="address" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bairro</Label>
            <Input name="neighborhood" className="h-9" required />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cidade</Label>
            <Input name="city" className="h-9" required />
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
          <Button type="submit" className="col-span-2 sm:col-span-3" disabled={isPending}>
            {isPending ? "Cadastrando..." : "Cadastrar clínica"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
