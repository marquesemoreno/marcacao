"use client";

import { useEffect, useRef, useState } from "react";
import { nextMediaIndex, TV_MEDIA_VOLUME } from "@/lib/tv-media";
import type { TvMediaView } from "@/actions/tv-call";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: any) => void;
  }
}

function loadScript(src: string) {
  if (document.querySelector(`script[src="${src}"]`)) return;
  const s = document.createElement("script");
  s.src = src;
  s.async = true;
  document.head.appendChild(s);
}

/** Área grande da TV em repouso: só conteúdo da própria clínica (imagens e vídeos enviados).
 * YouTube saiu em 28/11 — anúncios, qualidade que oscila e clarões na sala de espera.
 * Imagem: entra aos poucos por cima da anterior (1,5 s) e aproxima bem devagar.
 * Vídeo: levemente escurecido e entrando do preto, sem corte seco.
 * `ducked` = tem chamada: vídeo mudo e música pausada. */
export function TvMediaStage({ items, ducked, soundOn }: { items: TvMediaView[]; ducked: boolean; soundOn: boolean }) {
  const visual = items.filter((i) => (i.kind === "IMAGE" || i.kind === "VIDEO") && i.url);
  const music = items.find((i) => i.kind === "SPOTIFY" && i.url) ?? null;
  const [index, setIndex] = useState(0);
  const [previous, setPrevious] = useState<TvMediaView | null>(null);
  const current = visual.length ? visual[index % visual.length] : null;
  const next = () => {
    setPrevious(current?.kind === "IMAGE" ? current : null);
    setIndex((i) => nextMediaIndex(i, visual.length));
  };

  // A anterior sai depois que a nova terminou de aparecer por cima.
  useEffect(() => {
    if (!previous) return;
    const t = setTimeout(() => setPrevious(null), 1700);
    return () => clearTimeout(t);
  }, [previous]);

  // Imagem: troca depois de durationSec.
  useEffect(() => {
    if (current?.kind !== "IMAGE" || visual.length < 2) return;
    const t = setTimeout(next, current.durationSec * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index, visual.length]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.5vw] bg-black">
      <style>{`@keyframes tv-fade-in{from{opacity:0}to{opacity:1}}@keyframes tv-drift{from{transform:scale(1)}to{transform:scale(1.05)}}@media (prefers-reduced-motion: reduce){.tv-drift{animation:none!important}}`}</style>
      {previous && previous.id !== current?.id && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={previous.url!} alt="" aria-hidden className="absolute inset-0 h-full w-full object-contain" />
      )}
      {current?.kind === "VIDEO" && (
        <div key={`${current.id}-${index}`} className="absolute inset-0 motion-safe:animate-[tv-fade-in_1500ms_ease-out_both]">
          <VideoSlot url={current.url!} single={visual.length === 1} ducked={ducked} soundOn={soundOn} onEnd={next} />
        </div>
      )}
      {current?.kind === "IMAGE" && (
        <div key={`${current.id}-${index}`} className="absolute inset-0 overflow-hidden motion-safe:animate-[tv-fade-in_1500ms_ease-out_both]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url!}
            alt={current.title}
            className="tv-drift h-full w-full object-contain"
            style={{ animation: `tv-drift ${current.durationSec + 2}s linear both` }}
          />
        </div>
      )}
      {music && <SpotifySlot url={music.url!} ducked={ducked} />}
    </div>
  );
}

function VideoSlot({ url, single, ducked, soundOn, onEnd }: { url: string; single: boolean; ducked: boolean; soundOn: boolean; onEnd: () => void }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    v.volume = TV_MEDIA_VOLUME / 100;
    v.muted = ducked || !soundOn;
  }, [ducked, soundOn]);
  return (
    <video
      ref={ref}
      src={url}
      autoPlay
      playsInline
      muted
      loop={single}
      onEnded={onEnd}
      onError={onEnd}
      onLoadedData={(e) => {
        e.currentTarget.muted = ducked || !soundOn;
        void e.currentTarget.play().catch(() => {});
      }}
      className="h-full w-full object-contain brightness-90"
    />
  );
}

let spotifyApi: Promise<any> | null = null;
function loadSpotify(): Promise<any> {
  spotifyApi ??= new Promise((resolve) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api);
    loadScript("https://open.spotify.com/embed/iframe-api/v1");
  });
  return spotifyApi;
}

/** Música de fundo (player do Spotify, pequeno no canto). Pausa na chamada e retoma depois.
 * Música inteira só com conta Premium logada no navegador da TV. */
function SpotifySlot({ url, ducked }: { url: string; ducked: boolean }) {
  const host = useRef<HTMLDivElement>(null);
  const ctrl = useRef<any>(null);
  useEffect(() => {
    let cancelled = false;
    const m = url.match(/embed\/(\w+)\/(\w+)/);
    if (!m) return;
    void loadSpotify().then((api) => {
      if (cancelled || !host.current) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      api.createController(el, { uri: `spotify:${m[1]}:${m[2]}`, width: 300, height: 80 }, (c: any) => {
        ctrl.current = c;
        c.addListener("ready", () => c.play());
      });
    });
    return () => {
      cancelled = true;
      try {
        ctrl.current?.destroy();
      } catch {}
    };
  }, [url]);
  useEffect(() => {
    const c = ctrl.current;
    if (!c) return;
    if (ducked) c.pause();
    else c.resume();
  }, [ducked]);
  return <div ref={host} className="absolute bottom-3 left-3 z-10 opacity-80" />;
}
