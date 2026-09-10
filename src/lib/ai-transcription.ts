import "server-only";
import OpenAI, { toFile } from "openai";

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/** Extensão a partir do mimetype do áudio do WhatsApp (normalmente "audio/ogg;
 * codecs=opus") — a API de transcrição da OpenAI decide o formato pelo nome do
 * arquivo, não pelo Content-Type declarado. */
function extensionFromMimeType(mimeType: string): string {
  const base = mimeType.split(";")[0].trim();
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/wav": "wav",
    "audio/webm": "webm",
  };
  return map[base] ?? "ogg";
}

/** Transcreve um áudio (buffer já baixado do Storage) via API de transcrição
 * da OpenAI. Botão manual (ver transcribeMessageAudio em actions/inbox.ts) —
 * nunca automático, é a atendente quem decide gastar a chamada. Retorna
 * `null` se a IA não estiver configurada (sem API key) ou se a chamada falhar
 * — quem chama decide a mensagem de erro pro usuário. */
export async function transcribeAudio(buffer: Buffer, mimeType: string): Promise<string | null> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  try {
    const file = await toFile(buffer, `audio.${extensionFromMimeType(mimeType)}`);
    const result = await openai.audio.transcriptions.create({
      file,
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1",
      language: "pt",
    });
    return result.text?.trim() || null;
  } catch (error) {
    console.error("Falha ao transcrever áudio:", error);
    return null;
  }
}
