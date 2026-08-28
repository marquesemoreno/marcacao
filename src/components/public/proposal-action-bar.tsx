"use client";

import { Share2, Printer } from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { buildWhatsAppLink } from "@/lib/format";

const SALES_WHATSAPP = "5577988338000"; // Diretor Comercial Conecta Saúde

export function ProposalActionBar() {
  async function handleShare() {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Proposta Comercial — Conecta Saúde",
          text: "Programa de Credenciamento e Parceria para Clínicas e Laboratórios em Vitória da Conquista e Região",
          url,
        });
      } catch {
        // Ignora cancelamento nativo
      }
      return;
    }

    await navigator.clipboard.writeText(url);
    toast.success("Link da proposta comercial copiado!");
  }

  return (
    <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/90 bg-white/95 px-4 py-3 shadow-2xs backdrop-blur-md print:hidden sm:px-8">
      <div className="flex items-center gap-2">
        <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
        <p className="text-xs sm:text-sm font-semibold text-slate-700">
          Proposta Comercial Conecta Saúde — Credenciamento de Clínicas
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => window.print()}
          className="h-9 gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-300"
        >
          <Printer className="h-3.5 w-3.5 text-slate-500" />
          🖨️ Salvar em PDF / Imprimir
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={handleShare}
          className="h-9 gap-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 border-slate-300"
        >
          <Share2 className="h-3.5 w-3.5 text-slate-500" />
          Compartilhar
        </Button>

        <Button
          render={
            <a
              href={buildWhatsAppLink(
                SALES_WHATSAPP,
                "Olá! Li a proposta comercial da Conecta Saúde e gostaria de conversar com o Diretor Comercial para credenciar nossa clínica."
              )}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
          nativeButton={false}
          className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-2xs"
        >
          <WhatsAppIcon className="h-4 w-4" />
          Falar no WhatsApp com o Diretor Comercial
        </Button>
      </div>
    </div>
  );
}
