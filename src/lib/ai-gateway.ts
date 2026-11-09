import OpenAI, { toFile } from "openai";
import type {
  ChatCompletion,
  ChatCompletionCreateParamsNonStreaming,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";
import { PromptSanitizer } from "@/lib/security/prompt-sanitizer";

/**
 * Portão único da IA (LGPD, 09/11/2026). TODA chamada a modelo de IA (OpenAI,
 * TypeSafe/Jev) passa por aqui — o teste `ai-gateway.guard.test.ts` falha se alguém
 * criar cliente ou chamar a API em outro arquivo.
 *
 * Em cada chamada:
 * 1. mascara nome, CPF, telefone, e-mail, nascimento, RG/carteirinha, CEP e endereço
 *    em todas as mensagens (inclusive resultados e argumentos de ferramenta);
 * 2. avisa o modelo que os `{{PATIENT_*}}` são dados ocultos;
 * 3. restaura os dados reais no texto e nos argumentos de ferramenta da resposta;
 * 4. registra a chamada (função, clínica, quantos dados de cada tipo foram ocultados,
 *    imagem/áudio que não dá para mascarar) — NUNCA o conteúdo.
 *
 * Não substitui contrato com o fornecedor: o conteúdo de saúde ainda vai ao modelo.
 */

export type AiFeature =
  | "atendente"
  | "atendente-encerramento"
  | "copiloto"
  | "copiloto-recepcao"
  | "qualidade"
  | "lembrete"
  | "pedido-marcacao"
  | "nota-fiscal"
  | "documento"
  | "transcricao"
  | "resumo-relatorio"
  | "processos"
  | "prospeccao"
  | "intencao";

export interface AiCallContext {
  feature: AiFeature;
  clinicId?: string | null;
  /** Nomes do paciente/responsável já conhecidos (cadastro). */
  knownNames?: (string | null | undefined)[];
  /** O que nunca deve ser mascarado (nome da clínica, do médico, da atendente virtual…). */
  preserveTerms?: (string | null | undefined)[];
}

type ChatClient = { chat: { completions: { create: (p: ChatCompletionCreateParamsNonStreaming) => Promise<unknown> } } };

let client: OpenAI | null = null;
let testClient: ChatClient | null = null;
let testFetch: typeof fetch | null = null;

/** Só para testes. */
export function __setAiClientForTests(c: unknown) {
  testClient = (c as ChatClient | null) ?? null;
}
/** Só para testes. */
export function __setFetchForTests(f: typeof fetch | null) {
  testFetch = f;
}

function getOpenAi(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/** A IA (OpenAI) está configurada neste ambiente? */
export function isAiConfigured(): boolean {
  return Boolean(testClient || process.env.OPENAI_API_KEY);
}

const PRIVACY_NOTE =
  "Privacidade: textos no formato {{PATIENT_TIPO_n}} (ex.: {{PATIENT_NAME_1}}) são dados pessoais ocultados. " +
  "Quando precisar deles, escreva o token exatamente igual, com as chaves; nunca tente adivinhar o valor real.";

function newSanitizer(ctx: AiCallContext) {
  return new PromptSanitizer({ knownNames: ctx.knownNames, preserveTerms: ctx.preserveTerms });
}

function restoreJsonArgs(s: PromptSanitizer, args: string): string {
  try {
    return JSON.stringify(deepMap(JSON.parse(args), (v) => s.restore(v)));
  } catch {
    return s.restore(args);
  }
}

function maskJsonArgs(s: PromptSanitizer, args: string): string {
  try {
    return JSON.stringify(deepMap(JSON.parse(args), (v) => s.mask(v)));
  } catch {
    return s.mask(args);
  }
}

function deepMap(value: unknown, fn: (s: string) => string): unknown {
  if (typeof value === "string") return fn(value);
  if (Array.isArray(value)) return value.map((v) => deepMap(v, fn));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, deepMap(v, fn)]));
  }
  return value;
}

function maskMessages(s: PromptSanitizer, messages: ChatCompletionMessageParam[], unmaskable: { image: number }) {
  return messages.map((m) => {
    const copy = { ...m } as Record<string, unknown>;
    // Mensagem de ferramenta costuma ser JSON — mascara campo a campo para não quebrar.
    if (typeof copy.content === "string") {
      copy.content = m.role === "tool" ? maskJsonArgs(s, copy.content) : s.mask(copy.content);
    } else if (Array.isArray(copy.content)) {
      copy.content = (copy.content as Array<Record<string, unknown>>).map((part) => {
        if (part.type === "text" && typeof part.text === "string") return { ...part, text: s.mask(part.text) };
        if (part.type === "image_url") unmaskable.image += 1;
        return part;
      });
    }
    if (Array.isArray(copy.tool_calls)) {
      copy.tool_calls = (copy.tool_calls as Array<{ function?: { arguments?: string } }>).map((tc) =>
        tc.function?.arguments ? { ...tc, function: { ...tc.function, arguments: maskJsonArgs(s, tc.function.arguments) } } : tc,
      );
    }
    return copy as unknown as ChatCompletionMessageParam;
  });
}

function withPrivacyNote(messages: ChatCompletionMessageParam[]): ChatCompletionMessageParam[] {
  const note: ChatCompletionMessageParam = { role: "system", content: PRIVACY_NOTE };
  const firstNonSystem = messages.findIndex((m) => m.role !== "system");
  const at = firstNonSystem === -1 ? messages.length : firstNonSystem;
  return [...messages.slice(0, at), note, ...messages.slice(at)];
}

function logCall(ctx: AiCallContext, extra: Record<string, unknown>) {
  console.info(
    JSON.stringify({ event: "ai_call", feature: ctx.feature, clinicId: ctx.clinicId ?? null, ...extra }),
  );
}

/** Chat completion com a barreira LGPD. Lança erro se a IA não estiver configurada
 * (confira antes com `isAiConfigured()`) ou se a API falhar — igual ao SDK. */
export async function aiChat(ctx: AiCallContext, params: ChatCompletionCreateParamsNonStreaming): Promise<ChatCompletion> {
  const api: ChatClient | null = testClient ?? getOpenAi();
  if (!api) throw new Error("IA não configurada (falta OPENAI_API_KEY).");

  const s = newSanitizer(ctx);
  const unmaskable = { image: 0 };
  let messages = maskMessages(s, params.messages, unmaskable);
  if (s.size > 0) messages = withPrivacyNote(messages);

  const started = Date.now();
  const completion = (await api.chat.completions.create({ ...params, messages })) as ChatCompletion;
  logCall(ctx, {
    model: params.model,
    masked: s.counts(),
    ...(unmaskable.image ? { unmaskable } : {}),
    ms: Date.now() - started,
  });

  for (const choice of completion.choices ?? []) {
    const msg = choice.message as unknown as Record<string, unknown> | undefined;
    if (!msg) continue;
    if (typeof msg.content === "string") {
      const isJson = (params.response_format as { type?: string } | undefined)?.type === "json_object";
      msg.content = isJson ? restoreJsonArgs(s, msg.content) : s.restore(msg.content);
    }
    if (Array.isArray(msg.tool_calls)) {
      for (const tc of msg.tool_calls as Array<{ function?: { arguments?: string } }>) {
        if (tc.function?.arguments) tc.function.arguments = restoreJsonArgs(s, tc.function.arguments);
      }
    }
  }
  return completion;
}

/** Transcrição de áudio. A voz não tem como ser mascarada — a chamada fica
 * registrada como `unmaskable.audio`. `null` sem chave ou em falha. */
export async function aiTranscribe(
  ctx: AiCallContext,
  input: { buffer: Buffer; filename: string; model: string; language?: string },
): Promise<string | null> {
  const openai = getOpenAi();
  if (!openai) return null;
  const file = await toFile(input.buffer, input.filename);
  const started = Date.now();
  const result = await openai.audio.transcriptions.create({ file, model: input.model, language: input.language });
  logCall(ctx, { model: input.model, masked: {}, unmaskable: { audio: 1 }, ms: Date.now() - started });
  return result.text?.trim() || null;
}

const JEV_URL = "https://api.typesafe.ai/v1/systemone";

export type JevResponse = { answers?: Record<string, { type: string; choice?: string; confidence?: number }> };

/** Pergunta ao Jev (TypeSafe) com o `state` mascarado. `null` sem chave, erro ou
 * timeout. O Jev só devolve escolhas, então não há o que restaurar. */
export async function aiJev(
  ctx: AiCallContext,
  body: { model: string; state: unknown; questions: Record<string, unknown> },
): Promise<JevResponse | null> {
  const apiKey = process.env.JEVAI_API_KEY;
  if (!apiKey) return null;
  const s = newSanitizer(ctx);
  const state = deepMap(body.state, (v) => s.mask(v));
  const started = Date.now();
  const res = await (testFetch ?? fetch)(JEV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, state }),
    signal: AbortSignal.timeout(5000),
  });
  logCall(ctx, { model: body.model, provider: "typesafe", masked: s.counts(), ms: Date.now() - started });
  if (!res.ok) {
    console.error("Jev respondeu", res.status);
    return null;
  }
  return (await res.json()) as JevResponse;
}
