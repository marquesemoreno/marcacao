import "server-only";
import OpenAI from "openai";
import { prisma } from "@/lib/prisma";

/**
 * Regras fixas de LGPD/compliance que valem pra toda clínica, somadas às instruções
 * específicas cadastradas em AiAttendantConfig.instructions. Ficam aqui (não editável
 * pela clínica) pra nenhuma configuração de admin conseguir desligar sem querer a
 * identificação como IA ou a proibição de diagnóstico.
 */
const BASE_SYSTEM_PROMPT = `Você é um assistente virtual de atendimento da clínica {clinicName}, falando por WhatsApp.

Regras obrigatórias, nesta ordem de prioridade:
1. Você é uma Inteligência Artificial, não uma pessoa. Se o paciente perguntar, admita isso claramente.
2. Nunca forneça diagnóstico médico, interpretação de exame, laudo ou prescrição. Se perguntarem algo assim, explique que isso só pode ser respondido por um profissional e que você vai encaminhar para um atendente humano.
3. Nunca invente preço, procedimento, convênio ou horário que você não tem certeza — se não souber, diga que um atendente vai confirmar.
4. Seja objetivo, cordial e breve (2-4 frases por resposta).
5. Se perceber urgência médica, reclamação grave ou pedido explícito de falar com humano, apenas informe que vai transferir o atendimento — o sistema cuida da transferência automaticamente, você não precisa (nem deve) tentar resolver isso sozinho.`;

/** Mensagem de transparência + pedido de consentimento (Art. 9/11 LGPD), enviada antes
 * de qualquer resposta gerada por IA nessa conversa. Consentimento é por conversa. */
export function buildAiDisclosureMessage(clinicName: string): string {
  return `Olá! Este é um atendimento automatizado por Inteligência Artificial da ${clinicName}. Deseja continuar? Responda *SIM* para continuar.\n\nA qualquer momento você pode pedir para falar com um atendente humano.`;
}

export const AI_CONSENT_ACCEPTED_REPLY = "Perfeito! Como posso te ajudar?";
export const AI_HANDOFF_MESSAGE = "Vou te transferir para um atendente humano, aguarde um instante.";

/** Interpreta a resposta ao pedido de consentimento. `null` = ambígua (trata como recusa,
 * já que consentimento precisa ser uma afirmação inequívoca — nunca presumido). */
export function parseConsentReply(text: string): "ACCEPTED" | "DECLINED" {
  const normalized = text
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  const accepted = ["sim", "s", "continuar", "aceito", "concordo", "1"];
  return accepted.includes(normalized) ? "ACCEPTED" : "DECLINED";
}

/** Gatilhos que tiram a conversa do modo IA antes mesmo de chamar o modelo — nunca passam
 * pela IA, são checados no texto puro do paciente. Fixos no código nesta v1 (não editáveis
 * por clínica) pra nenhuma configuração remover um gatilho de segurança sem perceber. */
const ESCALATION_TRIGGERS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\b(atendente|humano|pessoa de verdade|falar com alguem|falar com algu[eé]m)\b/i, reason: "Pedido explícito de atendente humano" },
  { pattern: /\b(emergencia|emerg[eê]ncia|urgente|urg[eê]ncia)\b/i, reason: "Sinal de urgência/emergência" },
  { pattern: /\b(dor forte|dor insuportavel|dor insuport[aá]vel|sangramento|desmaio|desmaiei|falta de ar|nao consigo respirar|não consigo respirar)\b/i, reason: "Sinal de sintoma grave" },
  { pattern: /\b(reclama[cç][aã]o|processo|processar|advogado|procon)\b/i, reason: "Sinal de reclamação grave" },
];

export function matchEscalationTrigger(text: string): string | null {
  for (const trigger of ESCALATION_TRIGGERS) {
    if (trigger.pattern.test(text)) return trigger.reason;
  }
  return null;
}

export async function getAiAttendantConfig(clinicId: string) {
  const config = await prisma.aiAttendantConfig.findUnique({ where: { clinicId } });
  if (!config || !config.active) return null;
  return config;
}

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

/** Gera a resposta da IA a partir só do histórico DESSA conversa (data minimization —
 * nunca manda CPF, nunca manda outras conversas do mesmo contato). Retorna `null` se a
 * IA não está configurada (sem API key) ou se a chamada falhar — chamador deve tratar
 * isso como sinal pra escalar pra humano em vez de deixar o paciente sem resposta. */
export async function generateAiReply(
  conversationId: string,
  clinicName: string,
  instructions: string
): Promise<string | null> {
  const openai = getOpenAiClient();
  if (!openai) return null;

  const messages = await prisma.message.findMany({
    where: { conversationId, type: { not: "INTERNAL_NOTE" }, deletedAt: null },
    orderBy: { createdAt: "asc" },
    take: 20,
    select: { direction: true, content: true },
  });

  const systemPrompt = `${BASE_SYSTEM_PROMPT.replace("{clinicName}", clinicName)}\n\nInstruções específicas desta clínica:\n${instructions}`;

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({
          role: (m.direction === "INBOUND" ? "user" : "assistant") as "user" | "assistant",
          content: m.content,
        })),
      ],
      max_tokens: 400,
      temperature: 0.4,
    });
    return completion.choices[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.error("Falha ao gerar resposta do atendente de IA:", error);
    return null;
  }
}
