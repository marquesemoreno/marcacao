"use client";

import { useEffect, useRef, useState } from "react";
import { nextMediaIndex, parseYoutubeUrl, TV_MEDIA_VOLUME } from "@/lib/tv-media";
import type { TvMediaView } from "@/actions/tv-call";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
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

let ytReady: Promise<any> | null = null;
function youtubeApi(): Promise<any> {
  ytReady ??= new Promise((resolve) => {
    if (window.YT?.Player) return resolve(window.YT);
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    loadScript("https://www.youtube.com/iframe_api");
  });
  return ytReady;
}

/** Rodízio de vídeos/imagens (área grande da TV). `ducked` = tem chamada: vídeo fica mudo
 * e a música pausa; depois volta ao volume baixo. */
export function TvMediaStage({ items, ducked, soundOn }: { items: TvMediaView[]; ducked: boolean; soundOn: boolean }) {
  const visual = items.filter((i) => i.kind !== "SPOTIFY" && i.url);
  const music = items.find((i) => i.kind === "SPOTIFY" && i.url) ?? null;
  const [index, setIndex] = useState(0);
  const current = visual.length ? visual[index % visual.length] : null;
  const next = () => setIndex((i) => nextMediaIndex(i, visual.length));

  // Imagem: troca depois de durationSec.
  useEffect(() => {
    if (current?.kind !== "IMAGE") return;
    const t = setTimeout(next, current.durationSec * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, index]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-[1.5vw] bg-black">
      {current?.kind === "YOUTUBE" && <YoutubeSlot key={`${current.id}-${index}`} url={current.url!} single={visual.length === 1} ducked={ducked} soundOn={soundOn} onEnd={next} />}
      {current?.kind === "VIDEO" && <VideoSlot key={`${current.id}-${index}`} url={current.url!} single={visual.length === 1} ducked={ducked} soundOn={soundOn} onEnd={next} />}
      {current?.kind === "IMAGE" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={current.id} src={current.url!} alt={current.title} className="h-full w-full object-contain" />
      )}
      {music && <SpotifySlot url={music.url!} ducked={ducked} />}
    </div>
  );
}

function YoutubeSlot({ url, single, ducked, soundOn, onEnd }: { url: string; single: boolean; ducked: boolean; soundOn: boolean; onEnd: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<any>(null);
  const endRef = useRef(onEnd);
  endRef.current = onEnd;
  const yt = parseYoutubeUrl(url);

  useEffect(() => {
    let cancelled = false;
    void youtubeApi().then((YT) => {
      if (cancelled || !host.current || !yt) return;
      const el = document.createElement("div");
      host.current.appendChild(el);
      player.current = new YT.Player(el, {
        width: "100%",
        height: "100%",
        videoId: yt.videoId ?? undefined,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          playsinline: 1,
          ...(yt.playlistId ? { listType: "playlist", list: yt.playlistId, loop: 1 } : single && yt.videoId ? { loop: 1, playlist: yt.videoId } : {}),
        },
        events: {
          onReady: (e: any) => {
            e.target.setVolume(TV_MEDIA_VOLUME);
            if (!soundOn) e.target.mute();
            e.target.playVideo();
          },
          onStateChange: (e: any) => {
            // Playlist ou vídeo único repetem sozinhos; nos outros casos passa pro próximo.
            if (e.data === 0 && !yt.playlistId && !single) endRef.current();
          },
          onError: () => endRef.current(),
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        player.current?.destroy();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const p = player.current;
    if (!p?.setVolume) return;
    if (ducked || !soundOn) p.mute();
    else {
      p.unMute();
      p.setVolume(TV_MEDIA_VOLUME);
    }
  }, [ducked, soundOn]);

  return <div ref={host} className="absolute inset-0 [&_iframe]:h-full [&_iframe]:w-full" />;
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
      className="h-full w-full object-contain"
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
