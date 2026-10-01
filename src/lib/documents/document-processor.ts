import "server-only";
import OpenAI from "openai";
import { z } from "zod";
import { sanitizePromptForAI } from "@/lib/security/lgpd-sanitizer";

/**
 * Leitura e extração estruturada de documentos médicos (pedido de exame, receita,
 * carteirinha de convênio) enviados por foto no WhatsApp. Duas chamadas separadas
 * de propósito, não uma só:
 *   1. Visão (gpt-4o-mini lê a imagem) -> texto bruto. A imagem crua passa pela
 *      OpenAI nesse passo (mesmo nível de confiança que o atendente de IA e a
 *      extração de nota fiscal já têm hoje lendo conteúdo real de paciente).
 *   2. Texto (já mascarado pelo Vault, ver lgpd-sanitizer.ts) -> campos
 *      estruturados via forced tool-call. Só a partir daqui é que a garantia de
 *      "nenhum PII de paciente chega num modelo" passa a valer de verdade.
 */

export const ExtractedDocumentSchema = z.object({
  documentType: z.enum(["PEDIDO_EXAME", "RECEITA", "CARTEIRINHA_PLANO", "OUTRO"]),
  insuranceIdentified: z.string().nullable(),
  proceduresFound: z.array(z.string()),
  issuingDoctor: z.string().nullable(),
  issueDate: z.string().nullable(),
});
export type ExtractedDocument = z.infer<typeof ExtractedDocumentSchema>;

const FALLBACK_EXTRACTED_DOCUMENT: ExtractedDocument = {
  documentType: "OUTRO",
  insuranceIdentified: null,
  proceduresFound: [],
  issuingDoctor: null,
  issueDate: null,
};

export interface DocumentProcessingResult {
  /** Só em memória — nunca persistido (ver nota de propósito do Vault acima). */
  rawOcrText: string;
  extracted: ExtractedDocument;
}

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

const EXTRACT_DOCUMENT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "extrairDadosDocumentoMedico",
    description: "Extrai os campos estruturados de um documento médico (pedido de exame, receita ou carteirinha de convênio) a partir do texto transcrito dele.",
    parameters: {
      type: "object",
      properties: {
        documentType: {
          type: "string",
          enum: ["PEDIDO_EXAME", "RECEITA", "CARTEIRINHA_PLANO", "OUTRO"],
          description: "Tipo do documento.",
        },
        insuranceIdentified: { type: "string", description: "Nome do convênio/plano de saúde identificado. Omitir se não houver." },
        proceduresFound: {
          type: "array",
          items: { type: "string" },
          description: "Lista de exames/consultas/procedimentos solicitados no documento, cada um como string separada.",
        },
        issuingDoctor: { type: "string", description: "Nome e CRM do médico solicitante, como aparecer no documento. Omitir se não for legível." },
        issueDate: { type: "string", description: "Data de emissão do documento, formato AAAA-MM-DD. Omitir se não identificável." },
      },
      required: ["documentType", "proceduresFound"],
    },
  },
};

/** Chamada 1 — transcrição literal via visão, sem interpretar nada ainda
 * (interpretação acontece só na Chamada 2, sobre o texto já mascarado). */
async function readDocumentTextFromImage(openai: OpenAI, buffer: Buffer, mimeType: string): Promise<string> {
  const base64 = buffer.toString("base64");
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Transcreva literalmente todo o texto visível nesta imagem de um documento médico (pedido de exame, receita ou carteirinha de convênio). Não interprete, não resuma, não traduza — só transcreva o que está escrito, na ordem em que aparece.",
          },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
        ],
      },
    ],
    max_tokens: 1000,
    temperature: 0,
  });
  return completion.choices[0]?.message?.content?.trim() || "";
}

/** Chamada 2 — extração estruturada (forced tool-call, mesmo padrão de
 * invoice-extraction.ts) sobre o texto JÁ MASCARADO pelo Vault. */
async function extractStructuredFields(openai: OpenAI, sanitizedText: string): Promise<ExtractedDocument> {
  if (!sanitizedText.trim()) return FALLBACK_EXTRACTED_DOCUMENT;

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "Extraia os campos estruturados deste texto transcrito de um documento médico. Use a ferramenta. Nunca invente um exame ou dado que não está explicitamente no texto — omita o campo em vez de adivinhar. Trechos como {{PATIENT_NAME_1}} ou {{PATIENT_CPF_1}} são identificadores internos do sistema, ignore-os (não são o convênio nem o médico).",
      },
      { role: "user", content: sanitizedText },
    ],
    tools: [EXTRACT_DOCUMENT_TOOL],
    tool_choice: { type: "function", function: { name: "extrairDadosDocumentoMedico" } },
    max_tokens: 500,
    temperature: 0,
  });

  const call = completion.choices[0]?.message?.tool_calls?.[0];
  if (!call || call.type !== "function") return FALLBACK_EXTRACTED_DOCUMENT;

  let rawArgs: unknown;
  try {
    rawArgs = JSON.parse(call.function.arguments);
  } catch {
    return FALLBACK_EXTRACTED_DOCUMENT;
  }

  const parsed = ExtractedDocumentSchema.safeParse(rawArgs);
  return parsed.success ? parsed.data : FALLBACK_EXTRACTED_DOCUMENT;
}

/** `null` sem OPENAI_API_KEY ou em qualquer falha de rede/API — nunca lança,
 * mesmo contrato de extractInvoiceData. */
export async function processDocumentMessage(params: {
  buffer: Buffer;
  mimeType: string;
  knownPatientNames?: string[];
}): Promise<DocumentProcessingResult | null> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  try {
    const rawOcrText = await readDocumentTextFromImage(openai, params.buffer, params.mimeType);
    const { sanitizedText } = sanitizePromptForAI(rawOcrText, params.knownPatientNames);
    const extracted = await extractStructuredFields(openai, sanitizedText);
    return { rawOcrText, extracted };
  } catch (error) {
    console.error("Falha ao processar documento médico:", error);
    return null;
  }
}
