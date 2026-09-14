import "server-only";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";
import { buildClinicKnowledgeContext } from "@/lib/clinic-knowledge";

const DEFAULT_INSTRUCTIONS =
  "Responda dúvidas gerais sobre agendamento, horários e procedimentos com cordialidade e objetividade.";

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/**
 * Sugestões de resposta pro atendente revisar e decidir se usa — bem diferente
 * de generateAiReply (ai-attendant.ts), que manda a resposta direto pro
 * paciente sozinha. Aqui a IA NUNCA fala com o paciente: só rascunha, o
 * atendente escolhe inserir/editar ou enviar. Por isso funciona em qualquer
 * clínica, mesmo as que decidiram não ligar o atendimento autônomo por IA
 * ainda (Urolaser, Santa Clara) — não é a mesma decisão de risco.
 *
 * Usa as instruções da clínica (AiAttendantConfig) só como guia de tom/regras
 * quando existirem; funciona também sem nenhuma configurada.
 */
export async function generateReplySuggestions(
  conversationId: string,
  clinicId: string,
  clinicName: string
): Promise<string[]> {
  const openai = getOpenAiClient();
  if (!openai) return [];

  // `orderBy: desc` + `take: 20` + reverse — ver mesma correção e nota em ai-attendant.ts
  // (generateAiReply): com `orderBy: asc`, `take: 20` pegava as 20 mensagens mais ANTIGAS
  // em vez das mais recentes em qualquer conversa com mais de 20 mensagens no total.
  const [recentMessages, config, knowledgeContext] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { direction: true, content: true },
    }),
    prisma.aiAttendantConfig.findUnique({ where: { clinicId }, select: { instructions: true } }),
    buildClinicKnowledgeContext(clinicId),
  ]);
  const messages = recentMessages.reverse();

  if (messages.length === 0) return [];

  const instructions = config?.instructions?.trim() || DEFAULT_INSTRUCTIONS;
  const systemPrompt = `Você é um Copilot que ajuda um atendente humano da clínica ${clinicName} a responder pacientes pelo WhatsApp. Você NUNCA fala direto com o paciente — só sugere rascunhos pro atendente revisar, editar se quiser, e decidir se envia.

Regras obrigatórias:
- Nunca dê diagnóstico médico, interpretação de exame, laudo ou prescrição.
- Nunca invente preço, procedimento, convênio, horário ou preparo de exame — use ESTRITAMENTE a "Base de conhecimento da clínica" abaixo (quando existir); se não estiver lá, sugira dizer que um atendente vai confirmar.
- Seja objetivo e cordial (2-4 frases por sugestão).
- As sugestões devem ser genuinamente diferentes entre si (tom ou abordagem diferente), não variações triviais da mesma frase.

Instruções específicas desta clínica:
${instructions}${knowledgeContext ? `\n\nBase de conhecimento da clínica (fonte da verdade — não invente nada fora daqui):\n${knowledgeContext}` : ""}

Responda em JSON, exatamente neste formato: {"suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"]}`;

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
      max_tokens: 500,
      temperature: 0.7,
    });
    const raw = completion.choices[0]?.message?.content;
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const suggestions = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    return suggestions
      .filter((s: unknown): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s: string) => s.trim())
      .slice(0, 3);
  } catch (error) {
    console.error("Falha ao gerar sugestões do copilot:", error);
    return [];
  }
}
