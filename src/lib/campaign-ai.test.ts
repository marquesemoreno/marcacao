import { describe, it, expect } from "vitest";
import { campaignAiDecision, buildCampaignAiPrompt, parseCampaignAiOutput, CAMPAIGN_AI_MAX_REPLIES, CAMPAIGN_AI_WINDOW_DAYS, CAMPAIGN_AI_TAG } from "./campaign-ai";

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

  it("só pergunta se quer agendar consulta ou exame — dia e turno ficam com a atendente", () => {
    expect(prompt).toMatch(/consulta ou (um )?exame/i);
    expect(prompt).toMatch(/nunca pergunte (o )?dia/i);
    expect(prompt).toMatch(/turno/i);
  });

  it("pede para aguardar quando a pessoa quer agendar", () => {
    expect(prompt).toMatch(/aguard/i);
  });

  it("pede a resposta em JSON com o resultado", () => {
    expect(prompt).toContain("QUER_AGENDAR");
    expect(prompt).toContain("SEM_INTERESSE");
    expect(prompt).toContain("PERGUNTANDO");
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

describe("limite curto", () => {
  it("a Lara fala no máximo 2 vezes", () => {
    expect(CAMPAIGN_AI_MAX_REPLIES).toBe(2);
  });
});

describe("parseCampaignAiOutput", () => {
  it("lê mensagem e resultado", () => {
    expect(parseCampaignAiOutput('{"mensagem":"Ótimo! Aguarde um instante.","resultado":"QUER_AGENDAR"}')).toEqual({ text: "Ótimo! Aguarde um instante.", outcome: "QUER_AGENDAR" });
    expect(parseCampaignAiOutput('{"mensagem":"Tudo bem, obrigada!","resultado":"SEM_INTERESSE"}')).toEqual({ text: "Tudo bem, obrigada!", outcome: "SEM_INTERESSE" });
  });
  it("resultado desconhecido vira PERGUNTANDO", () => {
    expect(parseCampaignAiOutput('{"mensagem":"Oi!","resultado":"XYZ"}')).toEqual({ text: "Oi!", outcome: "PERGUNTANDO" });
  });
  it("sem JSON válido ou sem mensagem: null (fica com a recepção)", () => {
    expect(parseCampaignAiOutput("Oi, tudo bem?")).toBeNull();
    expect(parseCampaignAiOutput('{"resultado":"QUER_AGENDAR"}')).toBeNull();
    expect(parseCampaignAiOutput("")).toBeNull();
  });
});
