import "server-only";
import OpenAI from "openai";

export type AppointmentReplyAction = "CONFIRMED" | "CANCELLED" | "RESCHEDULE" | "UNCLEAR";

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

const CLASSIFY_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "classificarRespostaAgendamento",
    description: "Classifica a intenção do paciente ao responder um pedido de confirmação de agendamento médico.",
    parameters: {
      type: "object",
      properties: {
        acao: {
          type: "string",
          enum: ["CONFIRMED", "CANCELLED", "RESCHEDULE", "UNCLEAR"],
          description:
            "CONFIRMED: vai comparecer no horário marcado. CANCELLED: não vai comparecer / quer cancelar, sem pedir outra data. RESCHEDULE: quer mudar a data ou horário (mesmo dizendo que não pode no dia marcado, se junto pedir outra data). UNCLEAR: não dá pra saber, é dúvida sobre outro assunto, ou não tem relação nenhuma com a pergunta de confirmação.",
        },
      },
      required: ["acao"],
    },
  },
};

const VALID_ACTIONS: AppointmentReplyAction[] = ["CONFIRMED", "CANCELLED", "RESCHEDULE", "UNCLEAR"];

/**
 * "Function calling fluido" (item 6 do roadmap): substitui a lista fixa de frases
 * aceitas (ver resolveStatusFromReply/isRescheduleReply em appointment-reply.ts)
 * pro caso em que o paciente responde de um jeito que a lista não cobre — ex: "não
 * vou poder ir amanhã, pode ser sexta?". Só é chamada pelo webhook DEPOIS que o
 * match determinístico (grátis, instantâneo) já falhou, então o caminho comum
 * ("1", "sim", "não") nunca gera custo nem latência de IA.
 *
 * "Executiva" porque a ação decidida aqui É EXECUTADA direto (confirma/cancela o
 * agendamento de verdade, ver route.ts) sem revisão humana antes — bem diferente
 * do Copilot (ai-copilot.ts), que só rascunha sugestão pro atendente decidir. Por
 * isso o escopo fica estritamente fechado nessas 4 opções via tool_choice
 * forçado — nunca uma resposta livre de texto, nunca uma conversa.
 *
 * Retorna "UNCLEAR" (nunca lança) se a IA não estiver configurada ou a chamada
 * falhar — o chamador trata isso exatamente como uma resposta que não bateu com
 * nenhuma opção conhecida, caindo pro atendimento manual de sempre.
 */
export async function classifyAppointmentReply(text: string): Promise<AppointmentReplyAction> {
  const openai = getOpenAiClient();
  if (!openai) return "UNCLEAR";

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "Você está interpretando a resposta de um paciente a uma mensagem de confirmação de agendamento médico enviada por WhatsApp. Use a ferramenta pra classificar a intenção dele. Não responda nada além de chamar a ferramenta.",
        },
        { role: "user", content: text },
      ],
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: "function", function: { name: "classificarRespostaAgendamento" } },
      max_tokens: 60,
      temperature: 0,
    });

    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (!call || call.type !== "function") return "UNCLEAR";

    const args = JSON.parse(call.function.arguments) as { acao?: string };
    return VALID_ACTIONS.includes(args.acao as AppointmentReplyAction) ? (args.acao as AppointmentReplyAction) : "UNCLEAR";
  } catch (error) {
    console.error("Falha ao classificar resposta de agendamento via IA:", error);
    return "UNCLEAR";
  }
}
