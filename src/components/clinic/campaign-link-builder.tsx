"use client";

import { useState } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";
import { buildWhatsAppLink } from "@/lib/format";

const SOURCES = [
  { code: "site", label: "Site da clínica", phrase: "Vim pelo site" },
  { code: "gads", label: "Anúncio do Google", phrase: "Vi o anúncio no Google" },
  { code: "ig", label: "Instagram (bio, stories)", phrase: "Vim pelo Instagram" },
  { code: "fb", label: "Facebook", phrase: "Vim pelo Facebook" },
  { code: "gmn", label: "Google Meu Negócio", phrase: "Vim pelo Google" },
] as const;

/** "Vasectomia sem dor" → "vasectomia-sem-dor" (vira o código #site-vasectomia-sem-dor). */
function slug(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Gera o link de WhatsApp de uma campanha/página (ex.: cada botão do site da clínica). A
 * mensagem pré-preenchida termina com o código #<canal>-<campanha>, que o sistema lê na 1ª
 * mensagem (acquisition.ts) — o paciente aparece no CRM e no relatório "Por campanha". */
export function CampaignLinkBuilder({ whatsapp }: { whatsapp: string }) {
  const [source, setSource] = useState<(typeof SOURCES)[number]["code"]>("site");
  const [name, setName] = useState("");
  const s = SOURCES.find((x) => x.code === source)!;
  const code = slug(name);
  const message = `Olá! ${s.phrase} e quero agendar.${code ? ` #${source}-${code}` : ` #${source}`}`;
  const url = buildWhatsAppLink(whatsapp, message);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie o link manualmente.");
    }
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-200 dark:border-slate-800 p-3">
      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">Link por campanha ou página</p>
      <p className="text-xs text-muted-foreground">
        Um link para cada botão do site (ex.: página de vasectomia) ou cada anúncio. O paciente que chegar por ele aparece com a campanha no CRM e no relatório.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          De onde
          <select value={source} onChange={(e) => setSource(e.target.value as typeof source)} className="mt-1 block h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm">
            {SOURCES.map((x) => (
              <option key={x.code} value={x.code}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
          Nome da campanha ou página
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex.: Vasectomia"
            className="mt-1 block h-9 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2 text-sm"
          />
        </label>
      </div>
      <div className="rounded-md bg-slate-50 dark:bg-slate-900 p-2 text-xs text-slate-700 dark:text-slate-300">
        <p>
          Mensagem: <span className="font-medium">{message}</span>
        </p>
        <p className="mt-1 break-all text-muted-foreground">{url}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-600 px-3 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden /> Copiar link
      </button>
    </div>
  );
}
