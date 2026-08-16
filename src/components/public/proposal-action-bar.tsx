"use client";

import { Share2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/lib/format";

// TODO: substituir pelo número real do time comercial antes de divulgar a proposta.
const SALES_WHATSAPP = "77999990000";

export function ProposalActionBar() {
  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Proposta Comercial Conecta Saúde",
          text: "Programa de Parceria Comercial para Clínicas e Laboratórios de Vitória da Conquista",
          url,
        });
      } catch {
        // usuário cancelou o compartilhamento nativo — nada a fazer
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success("Link da proposta copiado!");
  }

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur print:hidden sm:px-6">
      <p className="text-sm font-medium text-slate-600">Proposta Comercial — Conecta Saúde</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" onClick={() => window.print()}>
          🖨️ Imprimir / Salvar em PDF
        </Button>
        <Button type="button" variant="outline" className="gap-1.5" onClick={handleShare}>
          <Share2 className="h-4 w-4" />
          Compartilhar Proposta
        </Button>
        <Button
          render={
            <a
              href={buildWhatsAppLink(
                SALES_WHATSAPP,
                "Olá! Vi a proposta comercial da Conecta Saúde e gostaria de conversar com um consultor."
              )}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          nativeButton={false}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
        >
          <MessageCircle className="h-4 w-4" />
          Falar com Consultor no WhatsApp
        </Button>
      </div>
    </div>
  );
}
