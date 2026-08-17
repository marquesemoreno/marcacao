"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function AffiliateCopyLinkButton({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const message = `Confira consultas e exames com preços especiais na Conecta Saúde: ${link}`;
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success("Link copiado! Agora é só colar na conversa do WhatsApp.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Copie o link manualmente.");
    }
  }

  return (
    <Button
      type="button"
      onClick={handleCopy}
      className="h-11 gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
    >
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copiado!" : "Copiar Link para o WhatsApp"}
    </Button>
  );
}
