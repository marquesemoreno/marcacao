"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerAffiliate } from "@/actions/affiliates";
import { useActionFeedback } from "@/hooks/use-action-feedback";
import { pixKeyTypeLabels } from "@/lib/format";
import type { PixKeyType } from "@prisma/client";

const pixTypeOptions: PixKeyType[] = ["CPF", "EMAIL", "PHONE", "RANDOM"];

export function AffiliateSignupForm() {
  const { isPending, run } = useActionFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  const [pixType, setPixType] = useState<PixKeyType>("PHONE");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      async () => {
        await registerAffiliate({
          name: String(formData.get("name") ?? ""),
          phone: String(formData.get("phone") ?? ""),
          city: String(formData.get("city") ?? ""),
          pixKey: String(formData.get("pixKey") ?? ""),
          pixType,
        });
      },
      {
        successMessage:
          "Cadastro recebido! Nossa equipe confirma sua ativação pelo WhatsApp em breve.",
        errorMessage: "Não foi possível enviar. Confira os campos e tente novamente.",
        onSuccess: () => {
          formRef.current?.reset();
          setPixType("PHONE");
        },
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
          <Label htmlFor="name">Nome completo</Label>
          <Input id="name" name="name" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="phone">WhatsApp</Label>
          <Input id="phone" name="phone" placeholder="(77) 90000-0000" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">Cidade</Label>
          <Input id="city" name="city" placeholder="Vitória da Conquista" className="h-11" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pixType">Tipo de chave PIX</Label>
          <Select value={pixType} onValueChange={(next) => next && setPixType(next as PixKeyType)}>
            <SelectTrigger id="pixType" className="h-11 w-full">
              <SelectValue placeholder="Tipo de chave">{() => pixKeyTypeLabels[pixType]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {pixTypeOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {pixKeyTypeLabels[option]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="pixKey">Chave PIX</Label>
          <Input id="pixKey" name="pixKey" placeholder="CPF, e-mail, telefone ou chave aleatória" className="h-11" required />
        </div>
      </div>

      <Button
        type="submit"
        size="lg"
        className="h-12 bg-emerald-600 text-base text-white hover:bg-emerald-700"
        disabled={isPending}
      >
        {isPending ? "Enviando..." : "Quero ser um Marcador"}
      </Button>
    </form>
  );
}
