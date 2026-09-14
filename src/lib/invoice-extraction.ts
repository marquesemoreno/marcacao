import "server-only";
import OpenAI from "openai";
import { isValidCpf } from "@/lib/cpf";
import { formatCpf, formatCurrency } from "@/lib/format";
import type { InvoiceData } from "@/lib/chat-messages";

export type { InvoiceData };

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

const EXTRACT_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "extrairDadosNotaFiscal",
    description: "Extrai os dados que o paciente forneceu pra emissão de nota fiscal a partir do texto de uma mensagem de WhatsApp.",
    parameters: {
      type: "object",
      properties: {
        cpf: { type: "string", description: "CPF do titular, só os dígitos ou como veio na mensagem. Omitir se não mencionado." },
        endereco: { type: "string", description: "Endereço completo mencionado. Omitir se não mencionado." },
        dependentes: { type: "string", description: "Nomes de dependentes/outras pessoas a incluir na nota, um por linha. Omitir se não mencionado." },
        valor: { type: "string", description: "Valor mencionado (ex: '150,00' ou 'R$ 150'). Omitir se não mencionado." },
      },
    },
  },
};

/** Tenta interpretar um valor em texto livre (\"R$150,00\", \"150\", \"150.00\") como
 * número — formato brasileiro (vírgula decimal, ponto de milhar). `null` se não der
 * pra reconhecer como número, caso em que quem chama mantém o texto cru da IA. */
function parseBrazilianCurrency(raw: string): number | null {
  const cleaned = raw.replace(/R\$\s?/i, "").trim();
  const normalized = cleaned.includes(",") ? cleaned.replace(/\./g, "").replace(",", ".") : cleaned;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

/** Extração por function calling (não response_format: json_object) — mesmo padrão de
 * classifyAppointmentReply (appointment-reply-ai.ts): campos fixos, tool_choice forçado,
 * mais confiável que pedir JSON livre pra um schema com vários campos opcionais.
 * `null` sem OPENAI_API_KEY ou em qualquer falha — nunca lança. */
export async function extractInvoiceData(text: string): Promise<InvoiceData | null> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "Extraia os dados de nota fiscal mencionados nesta mensagem de um paciente. Use a ferramenta. Nunca invente um dado que não foi mencionado — omita o campo em vez de adivinhar.",
        },
        { role: "user", content: text },
      ],
      tools: [EXTRACT_TOOL],
      tool_choice: { type: "function", function: { name: "extrairDadosNotaFiscal" } },
      max_tokens: 300,
      temperature: 0,
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== "function") return null;
    const args = JSON.parse(call.function.arguments) as Partial<InvoiceData>;

    const result: InvoiceData = {};
    if (args.cpf?.trim()) {
      // Mantém o texto cru se não for um CPF válido de verdade — não finge que
      // formatou algo que a IA pode ter extraído errado ou incompleto.
      result.cpf = isValidCpf(args.cpf) ? formatCpf(args.cpf) : args.cpf.trim();
    }
    if (args.endereco?.trim()) result.endereco = args.endereco.trim();
    if (args.dependentes?.trim()) result.dependentes = args.dependentes.trim();
    if (args.valor?.trim()) {
      const parsed = parseBrazilianCurrency(args.valor);
      result.valor = parsed !== null ? formatCurrency(parsed) : args.valor.trim();
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    console.error("Falha ao extrair dados de nota fiscal:", error);
    return null;
  }
}
