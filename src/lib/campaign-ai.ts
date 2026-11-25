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

export type CampaignAiOutcome = "QUER_AGENDAR" | "SEM_INTERESSE" | "DUVIDA" | "INDEFINIDO";

/** Frases fixas (pedido da clínica em 25/11: a IA respondeu "Que bom ver seu sorriso!" a um
 * emoji). A IA só CLASSIFICA a resposta do paciente; o texto é sempre um destes. */
export const CAMPAIGN_AI_TEXTS = {
  // Tom da recepção da Urolaser (docs/analise-tom-atendentes-urolaser.md): curto, "nós", sem emoji.
  pergunta: "Olá, tudo bem? Gostaria de agendar uma consulta ou um exame?",
  aguardar: "Certinho! Só um instante, que já vamos te atender por aqui.",
  obrigada: "Certinho! Ficamos à disposição.",
} as const;

/** O que responder e o que fazer depois. WAIT_ANSWER = perguntou, espera a resposta;
 * HANDOFF = sai de cena (conversa na fila da recepção); CLOSE = finaliza a conversa. */
export function campaignAiReply(
  outcome: CampaignAiOutcome,
  ctx: { alreadyAsked: boolean },
): { text: string | null; next: "WAIT_ANSWER" | "HANDOFF" | "CLOSE" } {
  if (outcome === "QUER_AGENDAR" || outcome === "DUVIDA") return { text: CAMPAIGN_AI_TEXTS.aguardar, next: "HANDOFF" };
  if (outcome === "SEM_INTERESSE") return { text: CAMPAIGN_AI_TEXTS.obrigada, next: "CLOSE" };
  if (!ctx.alreadyAsked) return { text: CAMPAIGN_AI_TEXTS.pergunta, next: "WAIT_ANSWER" };
  return { text: null, next: "HANDOFF" };
}

/** Prompt do classificador: lê a conversa desde a campanha e devolve só o resultado. */
export function buildCampaignAiPrompt(input: { clinicName: string }): string {
  return `Você classifica a resposta de um paciente a uma campanha de WhatsApp da ${input.clinicName} (a mensagem da campanha está no histórico). Não escreva nada para o paciente.

Responda SOMENTE em JSON: {"resultado": "QUER_AGENDAR" | "SEM_INTERESSE" | "DUVIDA" | "INDEFINIDO"}
- QUER_AGENDAR: quer marcar, tocou em "Quero agendar", disse sim, consulta, exame, ou pediu horário.
- SEM_INTERESSE: não quer, agora não, já fez, obrigado/dispensa, ou pediu para não receber.
- DUVIDA: fez uma pergunta (preço, convênio, endereço, preparo, saúde) ou contou algo que precisa de atendimento.
- INDEFINIDO: só emoji, figurinha, curtida, cumprimento ("oi", "bom dia") ou algo que não deixa claro se quer agendar.`;
}

/** Lê o JSON do classificador. null = inválido (fica com a recepção, nada é enviado). */
export function parseCampaignAiOutcome(raw: string | null | undefined): CampaignAiOutcome | null {
  if (!raw) return null;
  try {
    const r = (JSON.parse(raw) as { resultado?: unknown }).resultado;
    return r === "QUER_AGENDAR" || r === "SEM_INTERESSE" || r === "DUVIDA" ? r : "INDEFINIDO";
  } catch {
    return null;
  }
}
