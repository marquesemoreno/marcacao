"use server";
import "server-only";

import OpenAI from "openai";
import { requireClinicSession } from "@/lib/session";
import { updateAppointmentStatus } from "@/actions/clinic";
import { createClinicBroadcastCampaign } from "@/actions/clinic-broadcast";
import { ASSISTANT_TOOL_DEFINITIONS, executeAssistantTool, type PendingAssistantAction } from "@/lib/assistant-tools";
import type { ParsedBroadcastRecipient } from "@/lib/broadcast-csv";

/**
 * Copiloto Interno da Recepção — Server Action (não API route: este projeto não
 * tem nenhuma rota autenticada em src/app/api/, toda lógica por-clínica vive em
 * Server Actions com requireClinicSession(), ver src/actions/*.ts. Sem streaming
 * token-a-token nessa v1, não era requisito e manter o padrão evita abrir a
 * primeira exceção autenticada nas rotas da app).
 *
 * Mesmo padrão de generateAiReply (ai-attendant.ts): OpenAI function calling em
 * no máximo 1 rodada (chama as tools pedidas, devolve resultado, pega resposta
 * final em texto).
 */

export type CopilotChatMessage = { role: "user" | "assistant"; content: string };
export type CopilotTurnResult = { message: string; pendingAction?: PendingAssistantAction };

const SYSTEM_PROMPT = `Você é o Copiloto Interno da Recepção do Conecta Saúde — um assistente que ajuda a recepcionista a executar tarefas administrativas da clínica (consultar agenda, localizar agendamentos para cancelar, montar rascunhos de campanha de WhatsApp) via comandos em linguagem natural.

Regras obrigatórias:
1. Você NUNCA cancela um agendamento ou envia uma campanha diretamente — as tools de escrita (cancelAppointment, createCampaignDraft) só LOCALIZAM/MONTAM uma proposta; a mutação real só acontece quando a recepcionista clica em "Confirmar Ação" na interface, fora do seu controle.
2. Depois de chamar cancelAppointment ou createCampaignDraft, explique o que foi encontrado e deixe claro que está aguardando a confirmação da recepcionista — nunca diga que "já cancelou" ou "já enviou".
3. Seja objetivo e direto (poucas frases).`;

let client: OpenAI | null = null;
function getOpenAiClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!client) client = new OpenAI({ apiKey });
  return client;
}

export async function runCopilotCommand(history: CopilotChatMessage[]): Promise<CopilotTurnResult> {
  const { clinicId } = await requireClinicSession();
  const openai = getOpenAiClient();
  if (!openai) {
    return { message: "O assistente de IA não está configurado neste ambiente (falta OPENAI_API_KEY)." };
  }

  const conversationMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(-20).map((m) => ({ role: m.role, content: m.content })),
  ];

  const first = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: conversationMessages,
    tools: ASSISTANT_TOOL_DEFINITIONS,
    max_tokens: 500,
    temperature: 0.2,
  });
  const firstMessage = first.choices[0]?.message;
  const toolCalls = firstMessage?.tool_calls?.filter(
    (call): call is OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall => call.type === "function"
  );

  if (!toolCalls || toolCalls.length === 0) {
    return { message: firstMessage?.content?.trim() || "Não entendi o pedido — pode reformular?" };
  }

  const executed = await Promise.all(
    toolCalls.map(async (call) => ({
      call,
      result: await executeAssistantTool(call.function.name, call.function.arguments, { clinicId }),
    }))
  );
  const pendingAction = executed.find((e) => e.result.pendingAction)?.result.pendingAction;

  const second = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages: [
      ...conversationMessages,
      firstMessage!,
      ...executed.map(({ call, result }) => ({
        role: "tool" as const,
        tool_call_id: call.id,
        content: JSON.stringify(result.forModel),
      })),
    ],
    max_tokens: 500,
    temperature: 0.2,
  });

  return {
    message: second.choices[0]?.message?.content?.trim() || "Ação localizada — confira os dados abaixo.",
    pendingAction,
  };
}

/** `updateAppointmentStatus` (actions/clinic.ts) já faz requireClinicSession() e
 * confere de novo que o agendamento pertence à clínica da sessão — não confia no
 * que a tool de leitura devolveu antes, revalida posse na hora da escrita real.
 * Já dispara o aviso de cancelamento por WhatsApp (notifyAppointmentStatus). */
export async function confirmCopilotCancelAppointment(appointmentId: string) {
  await updateAppointmentStatus(appointmentId, "CANCELLED");
  return { success: true as const };
}

/** `createClinicBroadcastCampaign` também já faz requireClinicSession() (a
 * campanha nasce sempre da clínica da sessão atual, não da que o Copiloto leu
 * antes) e cria em status DRAFT por padrão — só dispara quando alguém clicar
 * em "Iniciar" depois, em /clinic/disparos. */
export async function confirmCopilotCampaignDraft(payload: {
  campaignName: string;
  messageTemplate: string;
  recipients: ParsedBroadcastRecipient[];
}) {
  return createClinicBroadcastCampaign(payload.campaignName, payload.messageTemplate, payload.recipients);
}
