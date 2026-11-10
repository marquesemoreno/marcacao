import "server-only";
import { getSupabaseServerClient, WHATSAPP_MEDIA_BUCKET } from "@/lib/supabase-server";

type EvolutionConfig = { apiUrl?: string; apiKey?: string; instanceName?: string };

export type FetchMediaResult = { success: true; base64: string } | { success: false; error: string };

/**
 * O webhook da Evolution API manda só metadados da mídia (mimetype, key da
 * mensagem) — o conteúdo em si (já decriptado) precisa ser buscado à parte
 * neste endpoint. Ver docs Evolution API v2: /chat/getBase64FromMediaMessage.
 * `config` já vem resolvido por quem chama (instância global ou exclusiva da clínica).
 * Devolve o motivo real da falha (em vez de só null) pra dar pra logar e diagnosticar —
 * documentos (PDF) costumam ser maiores/mais lentos que imagem, por isso o timeout maior.
 */
export async function fetchMediaBase64(
  messageKey: Record<string, unknown>,
  config: EvolutionConfig
): Promise<FetchMediaResult> {
  // Mensagem vinda da API oficial (encaminhada pela rota whatsapp-cloud): a key carrega o
  // id da mídia na Meta e a clínica — baixa direto da Graph API.
  if (typeof messageKey.cloudMediaId === "string" && typeof messageKey.cloudClinicId === "string") {
    const { fetchCloudMediaBase64 } = await import("@/lib/whatsapp-cloud-send");
    return fetchCloudMediaBase64(messageKey.cloudClinicId, messageKey.cloudMediaId);
  }
  const { apiUrl, apiKey, instanceName } = config;
  if (!apiUrl || !apiKey || !instanceName) {
    return { success: false, error: "Configuração da Evolution API ausente para esta instância." };
  }

  const baseUrl = apiUrl.replace(/\/$/, "");
  const targetUrl = `${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`;

  try {
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
      signal: AbortSignal.timeout(30000),
    });
    const rawText = await response.text();
    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${rawText.slice(0, 300)}` };
    }
    const data = JSON.parse(rawText) as { base64?: string };
    if (!data.base64) {
      return { success: false, error: `Resposta sem base64: ${rawText.slice(0, 300)}` };
    }
    return { success: true, base64: data.base64 };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido ao buscar mídia" };
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
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
  };
  const base = stripMimeParams(mimeType);
  return map[base] ?? base.split("/")[1] ?? "bin";
}

/** "M:SS" a partir de segundos inteiros — mesmo formato já usado no player de áudio da UI. */
export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

/**
 * Sobe um arquivo pro bucket privado do Supabase Storage — usado tanto pra
 * mídia recebida do paciente (decodificada de base64 da Evolution API)
 * quanto pra mídia enviada pelo atendente (upload direto do navegador).
 * Retorna o caminho salvo (não a URL — é privado, a URL assinada é gerada
 * só na hora de exibir, ver getSignedMediaUrl).
 */
export async function uploadWhatsAppMedia(
  conversationId: string,
  buffer: Buffer,
  mimeType: string
): Promise<{ path: string; sizeBytes: number } | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

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

/** Baixa o arquivo direto do bucket privado (sem passar por URL assinada) —
 * usado quando precisamos do conteúdo em si no servidor (ex: mandar pra API
 * de transcrição), não só exibir na tela. */
export async function downloadWhatsAppMedia(path: string): Promise<Buffer | null> {
  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).download(path);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}

/** URLs assinadas já geradas nesta instância do servidor (valem 1 h; reaproveitadas por
 * 50 min). Cada atualização do Chat pedia uma URL nova por mídia, uma chamada ao Storage
 * por arquivo — agora é uma chamada só, e só para o que não está no cache. */
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL_SEC = 60 * 60;
const SIGNED_URL_REUSE_MS = 50 * 60_000;

/** Gera as URLs assinadas de uma lista de mensagens numa chamada só ao Storage. */
export async function attachSignedUrls<T extends { mediaPath: string | null }>(
  messages: T[]
): Promise<(T & { mediaUrl: string | null })[]> {
  const now = Date.now();
  const missing = [
    ...new Set(
      messages
        .map((m) => m.mediaPath)
        .filter((p): p is string => !!p && !((signedUrlCache.get(p)?.expiresAt ?? 0) > now))
    ),
  ];
  if (missing.length > 0) {
    const supabase = getSupabaseServerClient();
    if (supabase) {
      const { data } = await supabase.storage.from(WHATSAPP_MEDIA_BUCKET).createSignedUrls(missing, SIGNED_URL_TTL_SEC);
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) {
          signedUrlCache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_REUSE_MS });
        }
      }
      if (signedUrlCache.size > 5000) {
        for (const [k, v] of signedUrlCache) if (v.expiresAt <= now) signedUrlCache.delete(k);
      }
    }
  }
  return messages.map((message) => ({
    ...message,
    mediaUrl: message.mediaPath ? (signedUrlCache.get(message.mediaPath)?.url ?? null) : null,
  }));
}
