import "server-only";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { isAutoSystemMessage } from "@/lib/chat-messages";

export type ResponseTimings = {
  firstResponseSec: number | null;
  resolutionSec: number | null;
};

type TimingMessage = { direction: "INBOUND" | "OUTBOUND"; type: string; content: string; createdAt: Date };

/** FRT (tempo até a primeira resposta) e TTR (tempo até resolver) — pura aritmética de
 * timestamp, sem IA. FRT ignora nota interna e mensagem automática (ver
 * isAutoSystemMessage) como "primeira resposta": nenhuma das duas é um humano/IA
 * respondendo de verdade ao paciente. `null` quando não dá pra calcular (ex: conversa
 * sem nenhuma mensagem do paciente, ou ainda sem resposta nenhuma). Função pura
 * (mensagens já em mãos) pra poder testar sem tocar no banco — ver computeResponseTimings. */
export function computeResponseTimingsFromMessages(messages: TimingMessage[], resolvedAt: Date | null): ResponseTimings {
  const firstInbound = messages.find((m) => m.direction === "INBOUND");
  if (!firstInbound) return { firstResponseSec: null, resolutionSec: null };

  const firstRealReply = messages.find(
    (m) => m.direction === "OUTBOUND" && m.type !== "INTERNAL_NOTE" && !isAutoSystemMessage(m.content)
  );

  const firstResponseSec = firstRealReply
    ? Math.round((firstRealReply.createdAt.getTime() - firstInbound.createdAt.getTime()) / 1000)
    : null;

  const resolutionSec = resolvedAt
    ? Math.round((resolvedAt.getTime() - firstInbound.createdAt.getTime()) / 1000)
    : null;

  return { firstResponseSec, resolutionSec };
}

/** Busca as mensagens/resolvedAt da conversa no banco e delega a conta pra
 * computeResponseTimingsFromMessages. */
export async function computeResponseTimings(conversationId: string): Promise<ResponseTimings> {
  const [conversation, messages] = await Promise.all([
    prisma.conversation.findUnique({ where: { id: conversationId }, select: { resolvedAt: true } }),
    prisma.message.findMany({
      where: { conversationId, deletedAt: null },
      orderBy: { createdAt: "asc" },
      select: { direction: true, type: true, content: true, createdAt: true },
    }),
  ]);
  return computeResponseTimingsFromMessages(messages, conversation?.resolvedAt ?? null);
}

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

type SentimentAnalysis = { sentiment: "POSITIVO" | "NEUTRO" | "NEGATIVO"; summary: string; complianceNotes: string } | null;

async function analyzeSentiment(conversationId: string): Promise<SentimentAnalysis> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  // Mesmo padrão de ai-copilot.ts: orderBy desc + take + reverse() (nunca orderBy asc +
  // take, que pega as mensagens mais ANTIGAS em conversa longa — bug já corrigido antes).
  const recentMessages = await prisma.message.findMany({
    where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { direction: true, content: true },
  });
  const messages = recentMessages.reverse();
  if (messages.length === 0) return null;

  const systemPrompt = `Você está analisando a qualidade de um atendimento já encerrado, feito por WhatsApp entre uma clínica/empresa e um paciente/cliente.

Avalie com base em boas práticas gerais de atendimento (cordialidade, clareza, se a dúvida foi respondida de forma completa) — não existe um documento formal de políticas pra comparar, então use seu próprio julgamento sobre o que é um bom atendimento.

Responda em JSON, exatamente neste formato:
{"sentiment": "POSITIVO" | "NEUTRO" | "NEGATIVO", "summary": "resumo de 1-2 frases do que foi essa conversa", "complianceNotes": "1-2 frases sobre a qualidade do atendimento prestado (cordialidade, clareza, completude) — vazio se não houver nada relevante a notar"}`;

  const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    ...messages.map((m) => ({
      role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
      content: m.content,
    })),
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: conversationMessages,
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const sentiment = parsed?.sentiment;
    if (sentiment !== "POSITIVO" && sentiment !== "NEUTRO" && sentiment !== "NEGATIVO") return null;
    return {
      sentiment,
      summary: typeof parsed?.summary === "string" ? parsed.summary.trim() : "",
      complianceNotes: typeof parsed?.complianceNotes === "string" ? parsed.complianceNotes.trim() : "",
    };
  } catch (error) {
    console.error("Falha ao analisar sentimento da conversa:", error);
    return null;
  }
}

/** Gera a auditoria de qualidade de uma conversa recém-resolvida — chamada fire-and-forget
 * a partir de resolveConversation/resolveConversationAdmin (nunca aguardada: não faz
 * sentido o atendente esperar uma chamada de IA só pra fechar o atendimento).
 *
 * Idempotente: se já existe uma auditoria pra essa conversa, não faz nada (protege contra
 * resolveConversationAdmin, que hoje não tem guarda contra chamar duas vezes). Sempre grava
 * FRT/TTR mesmo sem IA configurada — só sentiment/summary/complianceNotes dependem dela. */
export async function analyzeConversationQuality(conversationId: string): Promise<void> {
  const existing = await prisma.conversationQualityAudit.findUnique({ where: { conversationId } });
  if (existing) return;

  const [timings, analysis] = await Promise.all([
    computeResponseTimings(conversationId),
    analyzeSentiment(conversationId),
  ]);

  await prisma.conversationQualityAudit.create({
    data: {
      conversationId,
      firstResponseSec: timings.firstResponseSec,
      resolutionSec: timings.resolutionSec,
      sentiment: analysis?.sentiment,
      summary: analysis?.summary,
      complianceNotes: analysis?.complianceNotes,
    },
  });
}
