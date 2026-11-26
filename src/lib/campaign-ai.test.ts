import { describe, it, expect } from "vitest";
import { isAutoReply, campaignAiDecision, buildCampaignAiPrompt, parseCampaignAiOutcome, campaignAiReply, CAMPAIGN_AI_TEXTS, CAMPAIGN_AI_MAX_REPLIES, CAMPAIGN_AI_WINDOW_DAYS, CAMPAIGN_AI_TAG } from "./campaign-ai";

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

  it("áudio, foto ou documento (mesmo com legenda) ficam com a recepção, sem a Lara responder", () => {
    expect(campaignAiDecision({ ...base, text: "🎤 Áudio recebido", hasMedia: true })).toBe("HANDOFF");
    expect(campaignAiDecision({ ...base, text: "quero agendar", hasMedia: true })).toBe("HANDOFF");
  });
});

describe("buildCampaignAiPrompt (a IA só classifica, não escreve)", () => {
  const prompt = buildCampaignAiPrompt({ clinicName: "Urolaser" });

  it("pede só o resultado em JSON", () => {
    for (const r of ["QUER_AGENDAR", "SEM_INTERESSE", "DUVIDA", "INDEFINIDO", "AUTOMATICA"]) expect(prompt).toContain(r);
    expect(prompt).toMatch(/json/i);
  });

  it("emoji, figurinha ou cumprimento sozinho é INDEFINIDO", () => {
    expect(prompt).toMatch(/emoji/i);
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

describe("isAutoReply (mensagem automática de empresa)", () => {
  it("reconhece respostas automáticas comuns do WhatsApp Business", () => {
    expect(isAutoReply("O F e C Locações agradece seu contato. Como podemos ajudar?")).toBe(true);
    expect(isAutoReply("Agradecemos a sua mensagem. Não estamos disponíveis no momento, mas responderemos assim que possível.")).toBe(true);
    expect(isAutoReply("Olá agradeço seu contato. Como podemos ajudar?")).toBe(true);
    expect(isAutoReply("Esta é uma mensagem automática.")).toBe(true);
    expect(isAutoReply("Nosso horário de atendimento é de segunda a sexta, das 8h às 18h.")).toBe(true);
  });
  it("não confunde com resposta de paciente", () => {
    for (const t of ["Quero agendar", "Bom dia", "não", "Obrigado pelo contato, no momento não", "Está quanto com dr Maryse?", "Já agendei pra 27.11"]) {
      expect(isAutoReply(t)).toBe(false);
    }
  });
});

describe("parseCampaignAiOutcome", () => {
  it("lê o resultado", () => {
    expect(parseCampaignAiOutcome('{"resultado":"QUER_AGENDAR"}')).toBe("QUER_AGENDAR");
    expect(parseCampaignAiOutcome('{"resultado":"SEM_INTERESSE"}')).toBe("SEM_INTERESSE");
    expect(parseCampaignAiOutcome('{"resultado":"DUVIDA"}')).toBe("DUVIDA");
    expect(parseCampaignAiOutcome('{"resultado":"INDEFINIDO"}')).toBe("INDEFINIDO");
  });
  it("lê AUTOMATICA", () => {
    expect(parseCampaignAiOutcome('{"resultado":"AUTOMATICA"}')).toBe("AUTOMATICA");
  });
  it("resultado desconhecido vira INDEFINIDO", () => {
    expect(parseCampaignAiOutcome('{"resultado":"XYZ"}')).toBe("INDEFINIDO");
  });
  it("sem JSON: null (fica com a recepção)", () => {
    expect(parseCampaignAiOutcome("Oi")).toBeNull();
    expect(parseCampaignAiOutcome("")).toBeNull();
    expect(parseCampaignAiOutcome(null)).toBeNull();
  });
});

describe("campaignAiReply — sempre as mesmas frases (sem comentar emoji, sem improviso)", () => {
  it("quer agendar: pede para aguardar e passa para a recepção", () => {
    const r = campaignAiReply("QUER_AGENDAR", { alreadyAsked: false });
    expect(r).toEqual({ text: CAMPAIGN_AI_TEXTS.aguardar, next: "HANDOFF" });
  });
  it("dúvida: também pede para aguardar a recepção", () => {
    expect(campaignAiReply("DUVIDA", { alreadyAsked: true })).toEqual({ text: CAMPAIGN_AI_TEXTS.aguardar, next: "HANDOFF" });
  });
  it("sem interesse: agradece e finaliza", () => {
    expect(campaignAiReply("SEM_INTERESSE", { alreadyAsked: false })).toEqual({ text: CAMPAIGN_AI_TEXTS.obrigada, next: "CLOSE" });
  });
  it("indefinido (ex.: só um 😊): pergunta uma vez", () => {
    expect(campaignAiReply("INDEFINIDO", { alreadyAsked: false })).toEqual({ text: CAMPAIGN_AI_TEXTS.pergunta, next: "WAIT_ANSWER" });
  });
  it("indefinido de novo: não insiste, fica com a recepção sem mandar nada", () => {
    expect(campaignAiReply("INDEFINIDO", { alreadyAsked: true })).toEqual({ text: null, next: "HANDOFF" });
  });
  it("sem emoji, como a recepção", () => {
    for (const t of Object.values(CAMPAIGN_AI_TEXTS)) expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
  });
  it("mensagem automática de empresa: não responde e fecha a conversa", () => {
    expect(campaignAiReply("AUTOMATICA", { alreadyAsked: false })).toEqual({ text: null, next: "CLOSE" });
  });
  it("as frases fixas", () => {
    expect(CAMPAIGN_AI_TEXTS.pergunta).toBe("Olá, tudo bem? Gostaria de agendar uma consulta ou um exame?");
    expect(CAMPAIGN_AI_TEXTS.aguardar).toBe("Certinho! Só um instante, que já vamos te atender por aqui.");
    expect(CAMPAIGN_AI_TEXTS.obrigada).toBe("Certinho! Ficamos à disposição.");
    for (const t of Object.values(CAMPAIGN_AI_TEXTS)) expect(t).not.toMatch(/sorriso|transferi|hor[aá]rio|dia|turno/i);
  });
});
