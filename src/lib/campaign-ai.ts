/** Lara da campanha (25/11/2026): IA discreta que responde SÓ quem respondeu a uma campanha
 * com "Lara responde" ligado (BroadcastCampaign.aiFollowUp). Não é o atendente de IA da
 * clínica (ai-attendant.ts): não pede "SIM", não anuncia transferência, não vale para as
 * outras conversas. O próprio modelo da campanha já apresenta a Lara como assistente
 * virtual — a transparência vem dali; se perguntarem, ela confirma que é IA.
 *
 * Para quando: alguém da equipe responde, pedem atendente/urgência/reclamação, chega
 * mensagem sem texto ou com mídia, ou bate o limite de respostas. "Parar" é em silêncio: a conversa
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
  /** Áudio, foto ou documento (26/11: a Lara perguntava "Gostaria de agendar?" sem saber o que o áudio dizia). */
  hasMedia?: boolean;
}): CampaignAiDecision {
  if (!input.campaignSentAt) return "SKIP";
  if (input.now.getTime() - input.campaignSentAt.getTime() > CAMPAIGN_AI_WINDOW_DAYS * 86_400_000) return "SKIP";
  if (input.aiAttendantActive || input.conversationAiEnabled) return "SKIP";
  if (input.humanRepliedSinceCampaign || input.handedOff) return "SKIP";
  if (input.hasMedia || !input.text.trim()) return "HANDOFF";
  if (matchEscalationTrigger(input.text)) return "HANDOFF";
  if (input.repliesSoFar >= CAMPAIGN_AI_MAX_REPLIES) return "HANDOFF";
  return "REPLY";
}

export type CampaignAiOutcome = "QUER_AGENDAR" | "SEM_INTERESSE" | "DUVIDA" | "INDEFINIDO" | "AUTOMATICA";

const AUTO_REPLY_PATTERNS = [
  /agrade(?:ce|cemos|ço)\s+(?:o\s+|pelo\s+)?seu\s+contato/i,
  /n[aã]o\s+estamos\s+dispon[ií]veis/i,
  /responderemos\s+(?:assim\s+que|o\s+mais\s+r[aá]pido|em\s+breve)/i,
  /mensagem\s+autom[aá]tica/i,
  /hor[aá]rio\s+de\s+atendimento/i,
  /fora\s+do\s+(?:nosso\s+)?hor[aá]rio/i,
];

/** Resposta automática de WhatsApp Business (o número da campanha é de uma empresa). */
export function isAutoReply(text: string): boolean {
  return AUTO_REPLY_PATTERNS.some((re) => re.test(text));
}

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
  if (outcome === "AUTOMATICA") return { text: null, next: "CLOSE" };
  if (!ctx.alreadyAsked) return { text: CAMPAIGN_AI_TEXTS.pergunta, next: "WAIT_ANSWER" };
  return { text: null, next: "HANDOFF" };
}

/** Prompt do classificador: lê a conversa desde a campanha e devolve só o resultado. */
export function buildCampaignAiPrompt(input: { clinicName: string }): string {
  return `Você classifica a resposta de um paciente a uma campanha de WhatsApp da ${input.clinicName} (a mensagem da campanha está no histórico). Não escreva nada para o paciente.

Responda SOMENTE em JSON: {"resultado": "QUER_AGENDAR" | "SEM_INTERESSE" | "DUVIDA" | "INDEFINIDO" | "AUTOMATICA"}
- QUER_AGENDAR: quer marcar, tocou em "Quero agendar", disse sim, consulta, exame, ou pediu horário.
- SEM_INTERESSE: não quer, agora não, já fez, obrigado/dispensa, ou pediu para não receber.
- DUVIDA: fez uma pergunta (preço, convênio, endereço, preparo, saúde) ou contou algo que precisa de atendimento.
- AUTOMATICA: resposta automática de empresa ("agradece seu contato", "não estamos disponíveis", horário de atendimento).
- INDEFINIDO: só emoji, figurinha, curtida, cumprimento ("oi", "bom dia") ou algo que não deixa claro se quer agendar.`;
}

/** Lê o JSON do classificador. null = inválido (fica com a recepção, nada é enviado). */
export function parseCampaignAiOutcome(raw: string | null | undefined): CampaignAiOutcome | null {
  if (!raw) return null;
  try {
    const r = (JSON.parse(raw) as { resultado?: unknown }).resultado;
    return r === "QUER_AGENDAR" || r === "SEM_INTERESSE" || r === "DUVIDA" || r === "AUTOMATICA" ? r : "INDEFINIDO";
  } catch {
    return null;
  }
}
