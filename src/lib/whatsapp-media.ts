import "server-only";
import { getEvolutionConfig } from "@/lib/whatsapp";
import { getSupabaseServerClient, WHATSAPP_MEDIA_BUCKET } from "@/lib/supabase-server";

/**
 * O webhook da Evolution API manda só metadados da mídia (mimetype, key da
 * mensagem) — o conteúdo em si (já decriptado) precisa ser buscado à parte
 * neste endpoint. Ver docs Evolution API v2: /chat/getBase64FromMediaMessage.
 */
export async function fetchMediaBase64(messageKey: Record<string, unknown>): Promise<string | null> {
  const { apiUrl, apiKey, instanceName } = getEvolutionConfig();
  if (!apiUrl || !apiKey || !instanceName) return null;

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { base64?: string };
    return data.base64 ?? null;
  } catch {
    return null;
  }
}

/** WhatsApp manda tipos com parâmetro de codec ("audio/ogg; codecs=opus") — não dá pra usar isso
 * cru como extensão de arquivo nem sempre é bem aceito como Content-Type por outros serviços. */
function stripMimeParams(mimeType: string): string {
  return mimeType.split(";")[0].trim();
}

function extensionFromMimeType(mimeType: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
  };
  const base = stripMimeParams(mimeType);
  return map[base] ?? base.split("/")[1] ?? "bin";
}

/** Tamanho legível ("284 KB", "1.4 MB") a partir de bytes — mesma unidade usada na UI. */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** "M:SS" a partir de segundos inteiros — mesmo formato já usado no player de áudio da UI. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/**
 * Decodifica o base64 recebido da Evolution API e sobe pro bucket privado
 * do Supabase Storage. Retorna o caminho salvo (não a URL — é privado,
 * a URL assinada é gerada só na hora de exibir, ver getSignedMediaUrl).
 */
export async function uploadWhatsAppMedia(
  conversationId: string,
  base64: string,
  mimeType: string
): Promise<{ path: string; sizeBytes: number } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const buffer = Buffer.from(base64, "base64");
  const ext = extensionFromMimeType(mimeType);
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).upload(path, buffer, {
    contentType: stripMimeParams(mimeType),
    upsert: false,
  });

  if (error) {
    console.error("Falha ao subir mídia do WhatsApp pro Supabase Storage:", error.message);
    return null;
  }

  return { path, sizeBytes: buffer.byteLength };
}

/** URL temporária (1h) pro arquivo privado — gerada a cada leitura das mensagens, nunca persistida. */
export async function getSignedMediaUrl(path: string): Promise<string | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(WHATSAPP_MEDIA_BUCKET)
    .createSignedUrl(path, 60 * 60);

  if (error || !data) return null;
  return data.signedUrl;
}

/** Gera as URLs assinadas para uma lista de mensagens em paralelo (evita N chamadas sequenciais). */
export async function attachSignedUrls<T extends { mediaPath: string | null }>(
  messages: T[]
): Promise<(T & { mediaUrl: string | null })[]> {
  return Promise.all(
    messages.map(async (message) => ({
      ...message,
      mediaUrl: message.mediaPath ? await getSignedMediaUrl(message.mediaPath) : null,
    }))
  );
}
