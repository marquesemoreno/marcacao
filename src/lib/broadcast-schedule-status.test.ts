import { describe, expect, it } from "vitest";
import { campaignSituation, estimateCampaignFinish, nextMarketingWindowLabel, unknownTemplateVariables } from "./broadcast-schedule";

const br = (iso: string) => new Date(`${iso}-03:00`);

describe("estimateCampaignFinish", () => {
  it("cabe hoje: termina hoje", () => {
    const r = estimateCampaignFinish({ pending: 20, sentToday: 0, now: br("2026-10-15T09:00:00") });
    expect(r.businessDays).toBe(1);
    expect(r.finishIso).toBe("2026-10-15");
  });
  it("280 pendentes: ~96 por dia útil, pula fim de semana", () => {
    // qui 15/10 de manhã: 96 hoje, 96 sex, 88 seg
    const r = estimateCampaignFinish({ pending: 280, sentToday: 0, now: br("2026-10-15T09:00:00") });
    expect(r.businessDays).toBe(3);
    expect(r.finishIso).toBe("2026-10-19");
  });
  it("à noite começa no próximo dia útil", () => {
    const r = estimateCampaignFinish({ pending: 10, sentToday: 0, now: br("2026-10-16T18:30:00") });
    expect(r.finishIso).toBe("2026-10-19");
  });
  it("respeita o que já saiu hoje e o limite de 100/dia", () => {
    const r = estimateCampaignFinish({ pending: 10, sentToday: 100, now: br("2026-10-15T10:00:00") });
    expect(r.finishIso).toBe("2026-10-16");
  });
  it("nada pendente: zero dias", () => {
    expect(estimateCampaignFinish({ pending: 0, sentToday: 0, now: br("2026-10-15T10:00:00") }).businessDays).toBe(0);
  });
});

describe("nextMarketingWindowLabel", () => {
  it("antes das 9h: hoje às 9h; sexta à noite: segunda às 9h", () => {
    expect(nextMarketingWindowLabel(br("2026-10-15T07:00:00"))).toBe("hoje às 9h");
    expect(nextMarketingWindowLabel(br("2026-10-15T18:00:00"))).toBe("amanhã às 9h");
    expect(nextMarketingWindowLabel(br("2026-10-16T18:00:00"))).toBe("segunda às 9h");
  });
});

describe("campaignSituation", () => {
  const base = { status: "RUNNING" as const, pending: 50, sentToday: 10, yielding: false, now: br("2026-10-15T10:00:00") };
  it("enviando dentro do horário", () => {
    expect(campaignSituation(base)).toEqual({ tone: "ok", text: "Enviando — 1 mensagem a cada 4–6 min" });
  });
  it("fora do horário", () => {
    expect(campaignSituation({ ...base, now: br("2026-10-15T18:00:00") })).toEqual({ tone: "wait", text: "Fora do horário de envio — retoma amanhã às 9h" });
  });
  it("cedendo a vez", () => {
    expect(campaignSituation({ ...base, yielding: true }).text).toBe("Aguardando: lembretes ou outra campanha estão na frente");
  });
  it("limite do dia", () => {
    expect(campaignSituation({ ...base, sentToday: 100 }).text).toBe("Limite de hoje atingido (100/100) — retoma amanhã às 9h");
  });
  it("rascunho, pausada e concluída", () => {
    expect(campaignSituation({ ...base, status: "DRAFT" }).text).toBe("Rascunho — ainda não começou");
    expect(campaignSituation({ ...base, status: "PAUSED" }).text).toBe("Pausada");
    expect(campaignSituation({ ...base, status: "COMPLETED", pending: 0 }).text).toBe("Concluída");
  });
});

describe("unknownTemplateVariables", () => {
  it("aponta {{variaveis}} que o público não tem", () => {
    expect(unknownTemplateVariables("Oi {{nome}}, {{link}} {{medico}}", { nome: "a", link: "b" })).toEqual(["medico"]);
    expect(unknownTemplateVariables("Oi {{ nome }}", { nome: "a" })).toEqual([]);
  });
});
