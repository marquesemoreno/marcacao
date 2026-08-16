"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitPartnerLead } from "@/actions/partner-leads";
import { useActionFeedback } from "@/hooks/use-action-feedback";

const neighborhoods = ["Centro", "Recreio", "Candeias", "Patagônia", "Outro"];

export function PartnerLeadForm() {
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      async () => {
        await submitPartnerLead({
          contactName: String(formData.get("contactName") ?? ""),
          clinicName: String(formData.get("clinicName") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          email: String(formData.get("email") ?? ""),
          neighborhood: String(formData.get("neighborhood") ?? ""),
          specialties: String(formData.get("specialties") ?? ""),
          notes: String(formData.get("notes") ?? ""),
        });
      },
      {
        successMessage: "Recebemos seu contato! Nossa equipe vai falar com você em breve.",
        errorMessage: "Não foi possível enviar. Confira os campos e tente novamente.",
        onSuccess: () => formRef.current?.reset(),
      }
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="contactName">Nome do responsável</Label>
          <Input id="contactName" name="contactName" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="clinicName">Nome da clínica/consultório</Label>
          <Input id="clinicName" name="clinicName" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">Telefone/WhatsApp</Label>
          <Input id="phone" name="phone" placeholder="(77) 90000-0000" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="neighborhood">Bairro</Label>
          <Input
            id="neighborhood"
            name="neighborhood"
            list="partner-neighborhoods"
            placeholder="Centro, Recreio, Candeias..."
            className="h-11"
            required
          />
          <datalist id="partner-neighborhoods">
            {neighborhoods.map((neighborhood) => (
              <option key={neighborhood} value={neighborhood} />
            ))}
          </datalist>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="specialties">Especialidades/exames que realiza</Label>
          <Input
            id="specialties"
            name="specialties"
            placeholder="Ex: Cardiologia, Ultrassonografia..."
            className="h-11"
            required
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Observações (opcional)</Label>
        <Textarea id="notes" name="notes" placeholder="Conte um pouco mais sobre sua clínica" rows={3} />
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 bg-sky-600 text-base text-white hover:bg-sky-700"
        disabled={isPending}
      >
        {isPending ? "Enviando..." : "Quero ser parceiro"}
      </Button>
    </form>
  );
}
