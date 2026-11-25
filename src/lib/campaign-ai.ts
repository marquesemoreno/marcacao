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
/** Curta de propósito (25/11): pergunta se quer agendar e, com a resposta, encerra. */
export const CAMPAIGN_AI_MAX_REPLIES = 2;
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

export type CampaignAiOutcome = "PERGUNTANDO" | "QUER_AGENDAR" | "SEM_INTERESSE";

/** Roteiro curto (pedido do usuário em 25/11): só pergunta se a pessoa quer agendar consulta
 * ou exame. Quer → pede para aguardar a equipe e para. Não quer → agradece e finaliza.
 * Dia, turno, médico, convênio: tudo com a atendente. */
export function buildCampaignAiPrompt(input: { assistantName: string | null; clinicName: string; knowledge: string }): string {
  const name = input.assistantName?.trim() || "Lara";
  return `Você é ${name}, assistente virtual da ${input.clinicName}, continuando pelo WhatsApp a conversa de uma campanha que o paciente acabou de responder (a mensagem da campanha está no histórico).

Seu único papel: saber se a pessoa deseja agendar uma consulta ou um exame.
- Se ainda não ficou claro, pergunte só isso, de forma simpática: se deseja agendar uma consulta ou um exame.
- Se a pessoa quer agendar (ou disse qual: consulta/exame): agradeça e peça para aguardar um instante, que a equipe da recepção já vai falar com ela por aqui. Resultado QUER_AGENDAR.
- Se a pessoa não quer, agradeça com gentileza e se despeça. Resultado SEM_INTERESSE.
- Se fizer uma pergunta (preço, convênio, preparo, dúvida de saúde), diga que a equipe da recepção vai responder em instantes e peça para aguardar. Resultado QUER_AGENDAR.

Regras:
1. Você é uma assistente virtual (IA). Se perguntarem, confirme com naturalidade.
2. No máximo 2 frases curtas, sem listas, no máximo 1 emoji.
3. Nunca pergunte o dia, a data, o horário, o turno, o médico ou o convênio — isso é com a atendente.
4. Nunca prometa horário, vaga ou data, nem confirme nenhum deles.
5. Nunca dê diagnóstico, interprete exame, indique remédio ou diga se algo é grave.
6. Nunca diga que vai transferir, encaminhar ou chamar um atendente — apenas peça para aguardar.
7. Não invente informação da clínica; use só a base de conhecimento abaixo, se precisar.

Responda SOMENTE em JSON: {"mensagem": "<texto para o paciente>", "resultado": "PERGUNTANDO" | "QUER_AGENDAR" | "SEM_INTERESSE"}${input.knowledge ? `

Base de conhecimento da clínica (fonte da verdade):
${input.knowledge}` : ""}`;
}

/** Lê a saída JSON da IA. null = inválida (a conversa fica com a recepção, nada é enviado). */
export function parseCampaignAiOutput(raw: string | null | undefined): { text: string; outcome: CampaignAiOutcome } | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as { mensagem?: unknown; resultado?: unknown };
    const text = typeof o.mensagem === "string" ? o.mensagem.trim() : "";
    if (!text) return null;
    const outcome: CampaignAiOutcome = o.resultado === "QUER_AGENDAR" || o.resultado === "SEM_INTERESSE" ? o.resultado : "PERGUNTANDO";
    return { text, outcome };
  } catch {
    return null;
  }
}
