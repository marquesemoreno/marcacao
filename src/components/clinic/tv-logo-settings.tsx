"use client";

import { useRef, useState } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { saveTvLogo, startTvLogoUpload } from "@/actions/tv-call";
import { checkTvLogoUpload, TV_LOGO_ACCEPT } from "@/lib/tv-media";
import { getSupabaseClient } from "@/lib/supabase-client";

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4";
const BUCKET = "whatsapp-media";

/** Logo da clínica no topo do painel da TV (no lugar do nome). */
export function TvLogoSettings({ initial }: { initial: string | null }) {
  const [url, setUrl] = useState<string | null>(initial);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    const check = checkTvLogoUpload(file);
    if (!check.ok) return toast.error(check.error);
    const supabase = getSupabaseClient();
    if (!supabase) return toast.error("Armazenamento não configurado.");
    setBusy("upload");
    try {
      const { path, token } = await startTvLogoUpload({ type: file.type, size: file.size });
      const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error("Falha no envio do arquivo.");
      const res = await saveTvLogo(path);
      setUrl(res.url);
      toast.success("Logo salva. A TV mostra na próxima vez que a página abrir (ou às 4 h).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function remove() {
    setBusy("remove");
    try {
      await saveTvLogo(null);
      setUrl(null);
      toast.success("Logo removida. A TV volta a mostrar o nome da clínica.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível remover.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className={panel} aria-labelledby="tv-logo">
      <h2 id="tv-logo" className="text-sm font-semibold">Logo da clínica</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Aparece no canto de cima da TV, numa placa branca, no lugar do nome. PNG com fundo transparente fica melhor (até 2 MB).
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <div className="flex h-20 w-48 items-center justify-center rounded-lg bg-slate-950 p-2">
          {url ? (
            <div className="rounded-md bg-white px-2 py-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Logo atual" className="h-12 w-auto max-w-40 object-contain" />
            </div>
          ) : (
            <span className="text-xs text-slate-400">Sem logo: mostra o nome</span>
          )}
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept={TV_LOGO_ACCEPT} className="sr-only" id="tv-logo-file" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <label
            htmlFor="tv-logo-file"
            className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 has-[:focus-visible]:ring-2 ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            {busy === "upload" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Upload className="size-4" aria-hidden />}
            {url ? "Trocar logo" : "Enviar logo"}
          </label>
          {url && (
            <button
              type="button"
              disabled={!!busy}
              onClick={remove}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {busy === "remove" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Trash2 className="size-4" aria-hidden />} Remover
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
