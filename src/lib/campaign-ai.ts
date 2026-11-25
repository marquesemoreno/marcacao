/** Lara da campanha (25/11/2026): IA discreta que responde SÓ quem respondeu a uma campanha
 * com "Lara responde" ligado (BroadcastCampaign.aiFollowUp). Não é o atendente de IA da
 * clínica (ai-attendant.ts): não pede "SIM", não anuncia transferência, não vale para as
 * outras conversas. O próprio modelo da campanha já apresenta a Lara como assistente
 * virtual — a transparência vem dali; se perguntarem, ela confirma que é IA.
 *
 * Para quando: alguém da equipe responde, pedem atendente/urgência/reclamação, chega
 * mensagem sem texto, ou bate o limite de respostas. "Parar" é em silêncio: a conversa
 * ganha a tag CAMPAIGN_AI_TAG e segue na fila da recepção como qualquer outra.
 * Puro e testado (campaign-ai.test.ts); o lado servidor fica em campaign-ai-server.ts. */
import { matchEscalationTrigger } from "./ai-escalation";

export const CAMPAIGN_AI_WINDOW_DAYS = 7;
export const CAMPAIGN_AI_MAX_REPLIES = 4;
export const CAMPAIGN_AI_TAG = "🤖 Lara (campanha)";

export type CampaignAiDecision = "REPLY" | "HANDOFF" | "SKIP";

export function campaignAiDecision(input: {
  now: Date;
  /** Quando a campanha com Lara foi entregue a essa pessoa; null = não recebeu. */
  campaignSentAt: Date | null;
  aiAttendantActive: boolean;
  conversationAiEnabled: boolean;
  humanRepliedSinceCampaign: boolean;
  repliesSoFar: number;
  handedOff: boolean;
  text: string;
}): CampaignAiDecision {
  if (!input.campaignSentAt) return "SKIP";
  if (input.now.getTime() - input.campaignSentAt.getTime() > CAMPAIGN_AI_WINDOW_DAYS * 86_400_000) return "SKIP";
  if (input.aiAttendantActive || input.conversationAiEnabled) return "SKIP";
  if (input.humanRepliedSinceCampaign || input.handedOff) return "SKIP";
  if (!input.text.trim()) return "HANDOFF";
  if (matchEscalationTrigger(input.text)) return "HANDOFF";
  if (input.repliesSoFar >= CAMPAIGN_AI_MAX_REPLIES) return "HANDOFF";
  return "REPLY";
}

export function buildCampaignAiPrompt(input: { assistantName: string | null; clinicName: string; knowledge: string }): string {
  const name = input.assistantName?.trim() || "Lara";
  return `Você é ${name}, assistente virtual da ${input.clinicName}, continuando pelo WhatsApp a conversa de uma campanha que o paciente acabou de responder (a mensagem da campanha está no histórico).

Regras, nesta ordem:
1. Você é uma assistente virtual (IA). Se perguntarem, confirme com naturalidade.
2. Seja breve e calorosa: 1 a 3 frases, sem listas, no máximo 1 emoji.
3. Objetivo: entender se a pessoa quer marcar e anotar o pedido — consulta ou exame, preferência de médico, e quando prefere (manhã/tarde, dias). Quando tiver isso, diga que a equipe da recepção confirma o horário com ela por aqui.
4. Nunca prometa horário, vaga ou data, nem confirme nenhum deles — quem confirma é a recepção.
5. Nunca invente preço, convênio, preparo ou procedimento: use só a base de conhecimento abaixo. Se não estiver lá, diga que a recepção confirma.
6. Nunca dê diagnóstico, interprete exame, indique remédio ou diga se algo é grave.
7. Nunca diga que vai transferir, encaminhar ou chamar um atendente — a recepção acompanha a conversa e entra quando precisar.
8. Se a pessoa não tiver interesse, agradeça com gentileza e encerre.${input.knowledge ? `\n\nBase de conhecimento da clínica (fonte da verdade):\n${input.knowledge}` : ""}`;
}
