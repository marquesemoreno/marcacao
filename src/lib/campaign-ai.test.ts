import { describe, it, expect } from "vitest";
import { campaignAiDecision, buildCampaignAiPrompt, CAMPAIGN_AI_MAX_REPLIES, CAMPAIGN_AI_WINDOW_DAYS, CAMPAIGN_AI_TAG } from "./campaign-ai";

const now = new Date("2026-11-25T13:00:00Z");
const base = {
  now,
  campaignSentAt: new Date("2026-11-25T12:00:00Z"),
  aiAttendantActive: false,
  conversationAiEnabled: false,
  humanRepliedSinceCampaign: false,
  repliesSoFar: 0,
  handedOff: false,
  text: "Quero agendar",
};

describe("campaignAiDecision", () => {
  it("responde quem respondeu à campanha da Lara", () => {
    expect(campaignAiDecision(base)).toBe("REPLY");
  });

  it("sem campanha da Lara enviada para essa pessoa, não faz nada", () => {
    expect(campaignAiDecision({ ...base, campaignSentAt: null })).toBe("SKIP");
  });

  it(`depois de ${CAMPAIGN_AI_WINDOW_DAYS} dias da campanha, não responde mais`, () => {
    const old = new Date(now.getTime() - (CAMPAIGN_AI_WINDOW_DAYS * 24 + 1) * 3_600_000);
    expect(campaignAiDecision({ ...base, campaignSentAt: old })).toBe("SKIP");
  });

  it("alguém da equipe já respondeu: a Lara fica quieta", () => {
    expect(campaignAiDecision({ ...base, humanRepliedSinceCampaign: true })).toBe("SKIP");
  });

  it("o atendente de IA completo da clínica já cuida da conversa: não fala por cima", () => {
    expect(campaignAiDecision({ ...base, aiAttendantActive: true })).toBe("SKIP");
    expect(campaignAiDecision({ ...base, conversationAiEnabled: true })).toBe("SKIP");
  });

  it("já passou para a recepção: não volta", () => {
    expect(campaignAiDecision({ ...base, handedOff: true })).toBe("SKIP");
  });

  it(`no limite de ${CAMPAIGN_AI_MAX_REPLIES} respostas, passa em silêncio para a recepção`, () => {
    expect(campaignAiDecision({ ...base, repliesSoFar: CAMPAIGN_AI_MAX_REPLIES })).toBe("HANDOFF");
    expect(campaignAiDecision({ ...base, repliesSoFar: CAMPAIGN_AI_MAX_REPLIES - 1 })).toBe("REPLY");
  });

  it("pedido de atendente, urgência ou reclamação: passa para a recepção sem responder", () => {
    expect(campaignAiDecision({ ...base, text: "quero falar com um atendente" })).toBe("HANDOFF");
    expect(campaignAiDecision({ ...base, text: "estou com sangramento" })).toBe("HANDOFF");
    expect(campaignAiDecision({ ...base, text: "vou no procon" })).toBe("HANDOFF");
  });

  it("mensagem sem texto (só áudio/foto) fica com a recepção", () => {
    expect(campaignAiDecision({ ...base, text: "   " })).toBe("HANDOFF");
  });
});

describe("buildCampaignAiPrompt", () => {
  const prompt = buildCampaignAiPrompt({ assistantName: "Lara", clinicName: "Urolaser", knowledge: "Convênios: Unimed" });

  it("fala como a Lara e admite ser assistente virtual se perguntarem", () => {
    expect(prompt).toContain("Lara");
    expect(prompt).toMatch(/assistente virtual/i);
  });

  it("é discreta: nunca anuncia transferência e nunca promete horário", () => {
    expect(prompt).toMatch(/nunca diga que vai transferir/i);
    expect(prompt).toMatch(/nunca (prometa|confirme) hor[aá]rio/i);
  });

  it("usa só a base de conhecimento da clínica", () => {
    expect(prompt).toContain("Convênios: Unimed");
  });

  it("sem nome cadastrado, usa Lara", () => {
    expect(buildCampaignAiPrompt({ assistantName: null, clinicName: "X", knowledge: "" })).toContain("Lara");
  });
});

it("tag visível para a recepção", () => {
  expect(CAMPAIGN_AI_TAG).toMatch(/Lara/);
});
