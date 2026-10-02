"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

type TrackedLink = { channel: string; url: string };

function CopyLinkRow({ channel, url }: TrackedLink) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("Não foi possível copiar automaticamente. Copie o link manualmente.");
    }
  }

  return (
    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 dark:border-slate-800 px-3 py-2">
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-800 dark:text-slate-200">{channel}</p>
        <p className="text-xs text-muted-foreground truncate">{url}</p>
      </div>
      <Button type="button" size="sm" variant="outline" className="shrink-0 gap-1.5" onClick={handleCopy}>
        {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        {copied ? "Copiado!" : "Copiar Link"}
      </Button>
    </div>
  );
}

/** Links `wa.me` com texto pré-preenchido pra colar no botão de mensagem do Google Meu
 * Negócio, na bio do Instagram e no Facebook — o texto de cada um foi desenhado pra bater
 * nas palavras-chave genéricas do classificador (ver src/lib/acquisition.ts), então a
 * conversa já chega com `acquisitionChannel` certo em vez de "Não identificado". */
export function TrackedLinksCard({ links }: { links: TrackedLink[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Links Rastreados de WhatsApp</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cole cada link no lugar certo (botão &ldquo;Mensagem&rdquo; do Google Meu Negócio, bio do Instagram, botão do
          Facebook, botão de WhatsApp do site da clínica) — a mensagem pré-preenchida garante que a conversa entre já com a origem identificada no
          relatório.
        </p>
        <div className="space-y-2">
          {links.map((l) => (
            <CopyLinkRow key={l.channel} channel={l.channel} url={l.url} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
