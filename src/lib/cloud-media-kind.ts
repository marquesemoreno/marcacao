/** Tipo de mensagem de mídia na API oficial a partir do mimeType. GIF não é aceito como
 * imagem pela Meta (só JPEG/PNG/WEBP) — vai como documento. */
export type CloudMediaKind = "image" | "video" | "audio" | "document";

export function cloudMediaKind(mimeType: string): CloudMediaKind {
  const m = mimeType.split(";")[0].trim().toLowerCase();
  if (m === "image/jpeg" || m === "image/png" || m === "image/webp") return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "document";
}
