import { describe, expect, it } from "vitest";
import { nextMediaIndex, parseSpotifyUrl, parseYoutubeUrl, TV_MEDIA_ACCEPT, checkTvUpload } from "./tv-media";

describe("parseYoutubeUrl", () => {
  it("vídeo em vários formatos", () => {
    for (const u of ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://youtu.be/dQw4w9WgXcQ?t=3", "https://www.youtube.com/shorts/dQw4w9WgXcQ", "https://youtube.com/live/dQw4w9WgXcQ", "https://www.youtube.com/embed/dQw4w9WgXcQ"]) {
      expect(parseYoutubeUrl(u)).toEqual({ videoId: "dQw4w9WgXcQ", playlistId: null });
    }
  });
  it("playlist (com ou sem vídeo)", () => {
    expect(parseYoutubeUrl("https://www.youtube.com/playlist?list=PL123abc_-")).toEqual({ videoId: null, playlistId: "PL123abc_-" });
    expect(parseYoutubeUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL9")).toEqual({ videoId: "dQw4w9WgXcQ", playlistId: "PL9" });
  });
  it("recusa o que não é YouTube", () => {
    expect(parseYoutubeUrl("https://globoplay.globo.com/v/123")).toBeNull();
    expect(parseYoutubeUrl("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(parseYoutubeUrl("lixo")).toBeNull();
  });
});

describe("parseSpotifyUrl", () => {
  it("playlist, álbum, faixa e podcast viram endereço de embed", () => {
    expect(parseSpotifyUrl("https://open.spotify.com/playlist/37i9dQZF1DX0XUsuxWHRQd?si=abc")).toBe("https://open.spotify.com/embed/playlist/37i9dQZF1DX0XUsuxWHRQd");
    expect(parseSpotifyUrl("https://open.spotify.com/intl-pt/album/1ATL5GLyefJaxhQzSPVrLX")).toBe("https://open.spotify.com/embed/album/1ATL5GLyefJaxhQzSPVrLX");
    expect(parseSpotifyUrl("https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC")).toBe("https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC");
    expect(parseSpotifyUrl("https://open.spotify.com/show/2MAi0BvDc6GTFvKFPXnkCL")).toBe("https://open.spotify.com/embed/show/2MAi0BvDc6GTFvKFPXnkCL");
  });
  it("recusa outros sites", () => {
    expect(parseSpotifyUrl("https://spotify.evil.com/playlist/x")).toBeNull();
    expect(parseSpotifyUrl("https://open.spotify.com/user/abc")).toBeNull();
  });
});

describe("checkTvUpload", () => {
  it("vídeo MP4/WEBM até 200 MB, imagem até 10 MB", () => {
    expect(checkTvUpload({ type: "video/mp4", size: 150 * 1024 * 1024 })).toEqual({ ok: true, kind: "VIDEO" });
    expect(checkTvUpload({ type: "image/png", size: 2 * 1024 * 1024 })).toEqual({ ok: true, kind: "IMAGE" });
    expect(checkTvUpload({ type: "video/mp4", size: 201 * 1024 * 1024 }).ok).toBe(false);
    expect(checkTvUpload({ type: "image/jpeg", size: 11 * 1024 * 1024 }).ok).toBe(false);
    expect(checkTvUpload({ type: "application/pdf", size: 1000 }).ok).toBe(false);
  });
  it("accept do input cobre os tipos aceitos", () => {
    expect(TV_MEDIA_ACCEPT).toContain("video/mp4");
    expect(TV_MEDIA_ACCEPT).toContain("image/jpeg");
  });
});

describe("nextMediaIndex", () => {
  it("roda em círculo; lista vazia = -1", () => {
    expect(nextMediaIndex(0, 3)).toBe(1);
    expect(nextMediaIndex(2, 3)).toBe(0);
    expect(nextMediaIndex(5, 0)).toBe(-1);
    expect(nextMediaIndex(-1, 2)).toBe(0);
  });
});
