"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAffiliateAction } from "@/actions/affiliates";
import { useActionFeedback } from "@/hooks/use-action-feedback";

export function AffiliateLoginForm() {
  const { isPending, run } = useActionFeedback();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    run(
      async () => {
        await loginAffiliateAction({
          phone: String(formData.get("phone") ?? ""),
          code: String(formData.get("code") ?? ""),
        });
      },
      {
        errorMessage: "WhatsApp ou código de marcador inválido.",
        onSuccess: () => router.refresh(),
      }
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex w-full max-w-sm flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
    >
      <div className="space-y-1.5">
        <Label htmlFor="phone">WhatsApp cadastrado</Label>
        <Input id="phone" name="phone" placeholder="(77) 90000-0000" className="h-11" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="code">Código de marcador</Label>
        <Input id="code" name="code" placeholder="MARC-8492" className="h-11 uppercase" required />
      </div>
      <Button
        type="submit"
        size="lg"
        className="h-12 bg-emerald-600 text-base text-white hover:bg-emerald-700"
        disabled={isPending}
      >
        {isPending ? "Entrando..." : "Entrar no painel"}
      </Button>
    </form>
  );
}
