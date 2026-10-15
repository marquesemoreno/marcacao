import { describe, expect, it } from "vitest";
import { campaignSituation, estimateCampaignFinish, nextMarketingWindowLabel, unfilledPlaceholders, patientsNeedingCall, unknownTemplateVariables, urgentSendTimes } from "./broadcast-schedule";

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

describe("unfilledPlaceholders", () => {
  it("acha trechos do modelo ainda sem preencher", () => {
    expect(unfilledPlaceholders("👨‍⚕️ [NOME DO MÉDICO] — [ESPECIALIDADE]")).toEqual(["[NOME DO MÉDICO]", "[ESPECIALIDADE]"]);
    expect(unfilledPlaceholders("Dr. João — Urologia [obs]")).toEqual([]);
  });
});

describe("revezamento e feriados", () => {
  it("com outra campanha enviando, a previsão dobra", () => {
    const solo = estimateCampaignFinish({ pending: 150, sentToday: 0, now: br("2026-10-14T09:00:00") });
    const shared = estimateCampaignFinish({ pending: 150, sentToday: 0, now: br("2026-10-14T09:00:00"), sharing: 2 });
    expect(solo.businessDays).toBe(2);
    expect(shared.businessDays).toBe(4);
  });
  it("pula feriado nacional (sex 09/10 → seg 12/10 é feriado → ter 13/10)", () => {
    const r = estimateCampaignFinish({ pending: 120, sentToday: 0, now: br("2026-10-09T09:00:00") });
    expect(r.finishIso).toBe("2026-10-13");
  });
  it("situação mostra o revezamento", () => {
    expect(campaignSituation({ status: "RUNNING", pending: 10, sentToday: 1, yielding: false, now: br("2026-10-15T10:00:00"), sharing: 2 }).text).toBe(
      "Enviando em revezamento com outro envio — ~1 mensagem a cada 10 min"
    );
  });
});

describe("urgentSendTimes", () => {
  it("1 a cada 6 min dentro das 8h–18h, pulando a noite", () => {
    const t = urgentSendTimes(3, br("2026-10-15T17:50:00"));
    expect(t.map((d) => d.toISOString())).toEqual([
      br("2026-10-15T17:50:00").toISOString(),
      br("2026-10-15T17:56:00").toISOString(),
      br("2026-10-16T08:00:00").toISOString(),
    ]);
  });
  it("antes das 8h começa às 8h", () => {
    expect(urgentSendTimes(1, br("2026-10-15T06:00:00"))[0].toISOString()).toBe(br("2026-10-15T08:00:00").toISOString());
  });
});

describe("patientsNeedingCall", () => {
  const now = br("2026-10-15T17:00:00");
  const rows = [
    { id: "a", status: "PENDING", dataIso: "2026-10-16", horario: "08:00", sentAt: null },
    { id: "b", status: "PENDING", dataIso: "2026-10-16", horario: "14:00", sentAt: null },
    { id: "c", status: "SENT", dataIso: "2026-10-15", horario: "16:00", sentAt: br("2026-10-15T16:30:00") },
    { id: "d", status: "PENDING", dataIso: "2026-10-16", horario: "", sentAt: null },
  ];
  it("pendente que só recebe depois da consulta, enviado depois da hora e sem horário", () => {
    // 17:00 a, 17:06 b, 17:12 d (todos antes das 18h): a às 17h do dia 15 é antes das 8h do dia 16 → ok
    const r = patientsNeedingCall(rows, now);
    expect(r).toEqual([
      { id: "c", reason: "late" },
      { id: "d", reason: "no_time" },
    ]);
  });
  it("noite cheia: quem fica pra manhã depois do horário entra", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ id: `p${i}`, status: "PENDING", dataIso: "2026-10-16", horario: "08:00", sentAt: null }));
    const r = patientsNeedingCall(many, br("2026-10-15T17:00:00"));
    // 17:00..17:54 = 10 envios antes das 18h; p10 e p11 vão às 08:00 e 08:06 do dia 16 → 08:06 > 08:00
    expect(r.map((x) => x.id)).toEqual(["p11"]);
  });
});
