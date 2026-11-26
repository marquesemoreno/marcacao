import { errorSummary } from "@/lib/safe-error";
import "server-only";
import { aiTranscribe } from "./ai-gateway";

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

/** Contexto para o modelo: português do Brasil, paciente falando com a recepção de uma
 * clínica. Não inventar: se não der para entender, devolver vazio. */
const TRANSCRIBE_PROMPT =
  "Áudio de WhatsApp de um paciente para a recepção de uma clínica médica no Brasil (consulta, exame, agendamento, valor, horário, médico). Transcreva exatamente o que foi dito.";

/** Transcreve um áudio (buffer já baixado do Storage) via API de transcrição
 * da OpenAI. Botão manual (ver transcribeMessageAudio em actions/inbox.ts) —
 * nunca automático, é a atendente quem decide gastar a chamada. Retorna
 * `null` se a IA não estiver configurada (sem API key) ou se a chamada falhar
 * — quem chama decide a mensagem de erro pro usuário. */
export async function transcribeAudio(
  buffer: Buffer,
  mimeType: string,
  clinicId?: string | null,
): Promise<string | null> {
  try {
    return await aiTranscribe(
      { feature: "transcricao", clinicId },
      {
        buffer,
        filename: `audio.${extensionFromMimeType(mimeType)}`,
        // whisper-1 inventava frases em áudio curto ou com ruído (26/11: 3 s de áudio
        // viraram uma frase que o paciente nunca disse). gpt-4o-transcribe erra bem menos.
        model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-transcribe",
        language: "pt",
        prompt: TRANSCRIBE_PROMPT,
      },
    );
  } catch (error) {
    console.error("Falha ao transcrever áudio:", errorSummary(error));
    return null;
  }
}
