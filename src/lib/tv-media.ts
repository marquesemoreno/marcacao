/** Mídia da TV da sala de espera (vídeos/propaganda + música) — funções puras.
 * Globoplay/Netflix etc. bloqueiam embed (DRM + X-Frame-Options): não há como suportar. */

export type TvMediaKind = "YOUTUBE" | "VIDEO" | "IMAGE" | "SPOTIFY";
/** Tipos de TvMediaItem que são mídia (os do letreiro — TICKER_* — ficam fora do palco). */
export const TV_MEDIA_KINDS: TvMediaKind[] = ["YOUTUBE", "VIDEO", "IMAGE", "SPOTIFY"];

const YT_ID = /^[A-Za-z0-9_-]{11}$/;
const YT_LIST = /^[A-Za-z0-9_-]{2,64}$/;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** Vídeo e/ou playlist do YouTube; null se não for YouTube. */
export function parseYoutubeUrl(raw: string): { videoId: string | null; playlistId: string | null } | null {
  const u = safeUrl(raw);
  if (!u) return null;
  const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
  let videoId: string | null = null;
  if (host === "youtu.be") videoId = u.pathname.slice(1).split("/")[0];
  else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    const m = u.pathname.match(/^\/(?:shorts|live|embed)\/([^/?]+)/);
    videoId = m ? m[1] : u.searchParams.get("v");
  } else return null;
  const list = u.searchParams.get("list");
  const vid = videoId && YT_ID.test(videoId) ? videoId : null;
  const pl = list && YT_LIST.test(list) ? list : null;
  return vid || pl ? { videoId: vid, playlistId: pl } : null;
}

/** Endereço de embed do Spotify (playlist/álbum/faixa/artista/podcast); null se inválido. */
export function parseSpotifyUrl(raw: string): string | null {
  const u = safeUrl(raw);
  if (!u || u.hostname !== "open.spotify.com") return null;
  const m = u.pathname.match(/^\/(?:intl-[a-z-]+\/)?(?:embed\/)?(playlist|album|track|artist|show|episode)\/([A-Za-z0-9]{10,40})/);
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}` : null;
}

export const TV_VIDEO_TYPES = ["video/mp4", "video/webm"];
export const TV_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const TV_MEDIA_ACCEPT = [...TV_VIDEO_TYPES, ...TV_IMAGE_TYPES].join(",");
export const MAX_TV_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_TV_IMAGE_BYTES = 10 * 1024 * 1024;

export function checkTvUpload(file: { type: string; size: number }): { ok: true; kind: "VIDEO" | "IMAGE" } | { ok: false; error: string } {
  if (TV_VIDEO_TYPES.includes(file.type)) {
    return file.size <= MAX_TV_VIDEO_BYTES ? { ok: true, kind: "VIDEO" } : { ok: false, error: "Vídeo acima de 200 MB. Comprima ou suba no YouTube como não listado." };
  }
  if (TV_IMAGE_TYPES.includes(file.type)) {
    return file.size <= MAX_TV_IMAGE_BYTES ? { ok: true, kind: "IMAGE" } : { ok: false, error: "Imagem acima de 10 MB." };
  }
  return { ok: false, error: "Envie vídeo MP4/WEBM ou imagem JPG/PNG/WEBP." };
}

/** Próximo item do rodízio. */
export function nextMediaIndex(current: number, length: number): number {
  if (length <= 0) return -1;
  return current < 0 ? 0 : (current + 1) % length;
}

/** Volume do vídeo: baixo normalmente, 0 durante a chamada (0–100, escala do YouTube). */
export const TV_MEDIA_VOLUME = 15;
