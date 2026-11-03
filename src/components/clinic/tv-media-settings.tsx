"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Film, Image as ImageIcon, Loader2, Music, PlaySquare as Youtube, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { addTvMediaLink, deleteTvMedia, finishTvMediaUpload, listTvMedia, startTvMediaUpload, updateTvMedia, type TvMediaView } from "@/actions/tv-call";
import { checkTvUpload, TV_MEDIA_ACCEPT } from "@/lib/tv-media";
import { getSupabaseClient } from "@/lib/supabase-client";

const panel = "rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4";
const input = "h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50";
const BUCKET = "whatsapp-media";

const ICON = { YOUTUBE: Youtube, VIDEO: Film, IMAGE: ImageIcon, SPOTIFY: Music } as const;
const KIND_LABEL = { YOUTUBE: "YouTube", VIDEO: "Vídeo", IMAGE: "Imagem", SPOTIFY: "Música" } as const;

/** Vídeos/propaganda (rodízio) e música de fundo da TV. */
export function TvMediaSettings({ initial }: { initial: TvMediaView[] }) {
  const [items, setItems] = useState(initial);
  const [ytUrl, setYtUrl] = useState("");
  const [spUrl, setSpUrl] = useState("");
  const [uploading, setUploading] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => setItems(await listTvMedia());
  const act = (fn: () => Promise<unknown>, ok?: string) =>
    start(async () => {
      try {
        await fn();
        await refresh();
        if (ok) toast.success(ok);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Não deu certo.");
      }
    });

  async function upload(file: File) {
    const check = checkTvUpload(file);
    if (!check.ok) return toast.error(check.error);
    const supabase = getSupabaseClient();
    if (!supabase) return toast.error("Armazenamento indisponível.");
    setUploading(file.name);
    try {
      const { path, token, kind } = await startTvMediaUpload({ name: file.name, type: file.type, size: file.size });
      const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type });
      if (error) throw new Error(error.message.includes("size") ? "Arquivo maior que o limite do armazenamento." : "Falha no envio do arquivo.");
      await finishTvMediaUpload({ path, kind, title: file.name.replace(/\.[^.]+$/, "") });
      await refresh();
      toast.success("Arquivo adicionado à TV");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const visual = items.filter((i) => i.kind !== "SPOTIFY");
  const music = items.find((i) => i.kind === "SPOTIFY");

  return (
    <section className={panel} aria-labelledby="tv-media">
      <h2 id="tv-media" className="text-sm font-semibold">Vídeos e propaganda</h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Tocam em sequência na TV, com som baixo. Na chamada o vídeo fica mudo e o nome toma a tela. Globoplay, Netflix e outros streamings não permitem exibição em outro site.
      </p>

      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {visual.length === 0 && <li className="py-2 text-sm text-slate-500">Nada ainda — a TV mostra só as chamadas.</li>}
        {visual.map((m, i) => {
          const Icon = ICON[m.kind];
          return (
            <li key={m.id} className={`flex flex-wrap items-center gap-2 py-2 text-sm ${m.active ? "" : "opacity-50"}`}>
              <Icon className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
              <span className="min-w-0 flex-1 truncate" title={m.title}>
                {m.title} <span className="text-xs text-slate-500">· {KIND_LABEL[m.kind]}</span>
              </span>
              {m.kind === "IMAGE" && (
                <label className="inline-flex items-center gap-1 text-xs text-slate-600 dark:text-slate-400">
                  <input
                    type="number"
                    min={5}
                    max={120}
                    defaultValue={m.durationSec}
                    onBlur={(e) => Number(e.target.value) !== m.durationSec && act(() => updateTvMedia(m.id, { durationSec: Number(e.target.value) }))}
                    className={`${input} h-8 w-16 px-2`}
                    aria-label={`Segundos na tela: ${m.title}`}
                  />
                  s
                </label>
              )}
              <button type="button" disabled={pending || i === 0} onClick={() => act(() => updateTvMedia(m.id, { move: -1 }))} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800" aria-label={`Subir ${m.title}`}>
                <ArrowUp className="h-4 w-4" />
              </button>
              <button type="button" disabled={pending || i === visual.length - 1} onClick={() => act(() => updateTvMedia(m.id, { move: 1 }))} className="inline-flex size-8 items-center justify-center rounded-md hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800" aria-label={`Descer ${m.title}`}>
                <ArrowDown className="h-4 w-4" />
              </button>
              <label className="inline-flex items-center gap-1 text-xs">
                <input type="checkbox" checked={m.active} onChange={(e) => act(() => updateTvMedia(m.id, { active: e.target.checked }))} className="size-4 accent-emerald-600" />
                Ativo
              </label>
              <button type="button" disabled={pending} onClick={() => act(() => deleteTvMedia(m.id), "Removido")} className="inline-flex size-8 items-center justify-center rounded-md text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40" aria-label={`Remover ${m.title}`}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="yt-url">Link do YouTube</label>
        <input id="yt-url" value={ytUrl} onChange={(e) => setYtUrl(e.target.value)} placeholder="Link do YouTube (vídeo ou playlist)" className={`${input} min-w-0 flex-1`} />
        <button
          type="button"
          disabled={pending || !ytUrl.trim()}
          onClick={() => act(async () => { await addTvMediaLink({ kind: "YOUTUBE", url: ytUrl }); setYtUrl(""); }, "Vídeo adicionado")}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-40 dark:border-slate-700"
        >
          <Youtube className="h-4 w-4" aria-hidden /> Adicionar
        </button>
        <input ref={fileRef} type="file" accept={TV_MEDIA_ACCEPT} className="hidden" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
        <button
          type="button"
          disabled={!!uploading}
          onClick={() => fileRef.current?.click()}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-700 px-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-60"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Upload className="h-4 w-4" aria-hidden />}
          {uploading ? `Enviando ${uploading}…` : "Enviar vídeo ou imagem"}
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">Vídeo MP4/WEBM até 200 MB · imagem JPG/PNG/WEBP até 10 MB.</p>

      <h3 className="mt-5 flex items-center gap-2 text-sm font-semibold">
        <Music className="h-4 w-4 text-emerald-600" aria-hidden /> Música de fundo (Spotify)
      </h3>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
        Pausa na chamada e volta depois. Música inteira só com conta Premium logada no navegador da TV (sem login, trechos de 30 s). Uso em estabelecimento
        comercial depende dos termos do Spotify e do ECAD — responsabilidade da clínica.
      </p>
      {music ? (
        <div className="mt-2 flex items-center gap-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{music.source.replace("https://open.spotify.com/embed/", "")}</span>
          <label className="inline-flex items-center gap-1 text-xs">
            <input type="checkbox" checked={music.active} onChange={(e) => act(() => updateTvMedia(music.id, { active: e.target.checked }))} className="size-4 accent-emerald-600" />
            Ativa
          </label>
          <button type="button" onClick={() => act(() => deleteTvMedia(music.id), "Música removida")} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-rose-700 hover:bg-rose-50 dark:text-rose-300 dark:hover:bg-rose-950/40">
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remover
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor="sp-url">Link do Spotify</label>
          <input id="sp-url" value={spUrl} onChange={(e) => setSpUrl(e.target.value)} placeholder="Link da playlist ou álbum do Spotify" className={`${input} min-w-0 flex-1`} />
          <button
            type="button"
            disabled={pending || !spUrl.trim()}
            onClick={() => act(async () => { await addTvMediaLink({ kind: "SPOTIFY", url: spUrl }); setSpUrl(""); }, "Música adicionada")}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-sm font-medium disabled:opacity-40 dark:border-slate-700"
          >
            <Music className="h-4 w-4" aria-hidden /> Adicionar
          </button>
        </div>
      )}
    </section>
  );
}
