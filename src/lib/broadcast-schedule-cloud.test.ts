import { describe, it, expect } from "vitest";
import { cloudBatchSize, cloudDailyCap, campaignSituation, estimateCampaignFinish, CLOUD_PER_MINUTE } from "./broadcast-schedule";

// Quarta, 25/11/2026, 09:00 de Brasília (12:00 UTC).
const wed9 = new Date("2026-11-25T12:00:00Z");

describe("cloudDailyCap (nível de mensagens da Meta, 90% para sobrar espaço à recepção)", () => {
  it("TIER_250 → 225", () => expect(cloudDailyCap("TIER_250")).toBe(225));
  it("TIER_1K → 900", () => expect(cloudDailyCap("TIER_1K")).toBe(900));
  it("TIER_2K → 1800", () => expect(cloudDailyCap("TIER_2K")).toBe(1800));
  it("TIER_10K → 9000", () => expect(cloudDailyCap("TIER_10K")).toBe(9000));
  it("TIER_100K → 90000", () => expect(cloudDailyCap("TIER_100K")).toBe(90000));
  it("TIER_UNLIMITED → bem alto", () => expect(cloudDailyCap("TIER_UNLIMITED")).toBeGreaterThanOrEqual(100000));
  it("desconhecido ou sem resposta da Meta: o menor nível (seguro)", () => {
    expect(cloudDailyCap(null)).toBe(225);
    expect(cloudDailyCap("TIER_XYZ")).toBe(225);
  });
});

describe("cloudBatchSize (API oficial)", () => {
  it(`manda até ${CLOUD_PER_MINUTE} por minuto`, () => {
    expect(cloudBatchSize({ sentToday: 0, pending: 500, cap: 900 })).toBe(CLOUD_PER_MINUTE);
  });
  it("não passa do que está na fila", () => {
    expect(cloudBatchSize({ sentToday: 0, pending: 2, cap: 900 })).toBe(2);
  });
  it("respeita o teto das últimas 24 h", () => {
    expect(cloudBatchSize({ sentToday: 220, pending: 500, cap: 225 })).toBe(5);
    expect(cloudBatchSize({ sentToday: 225, pending: 500, cap: 225 })).toBe(0);
    expect(cloudBatchSize({ sentToday: 230, pending: 500, cap: 225 })).toBe(0);
  });
});

describe("estimateCampaignFinish com API oficial", () => {
  it("2 destinatários às 9h terminam hoje", () => {
    expect(estimateCampaignFinish({ pending: 2, sentToday: 0, now: wed9, cloud: true, cloudCap: 225 })).toEqual({ businessDays: 1, finishIso: "2026-11-25" });
  });
  it("2.598 no TIER_250 (225/dia) levam 12 dias úteis", () => {
    expect(estimateCampaignFinish({ pending: 2598, sentToday: 0, now: wed9, cloud: true, cloudCap: 225 }).businessDays).toBe(12);
  });
  it("2.598 no TIER_1K (900/dia) levam 3 dias úteis", () => {
    expect(estimateCampaignFinish({ pending: 2598, sentToday: 0, now: wed9, cloud: true, cloudCap: 900 })).toEqual({ businessDays: 3, finishIso: "2026-11-27" });
  });
});

describe("campaignSituation com API oficial", () => {
  it("fala do ritmo da API oficial e do teto", () => {
    const s = campaignSituation({ status: "RUNNING", pending: 10, sentToday: 0, yielding: false, now: wed9, cloud: true, cloudCap: 225 });
    expect(s.text).toMatch(/API oficial/);
    expect(s.text).toContain("225");
  });
  it("teto atingido espera", () => {
    const s = campaignSituation({ status: "RUNNING", pending: 10, sentToday: 225, yielding: false, now: wed9, cloud: true, cloudCap: 225 });
    expect(s.tone).toBe("wait");
    expect(s.text).toMatch(/Meta/);
  });
  it("100 enviadas não travam com nível maior", () => {
    expect(campaignSituation({ status: "RUNNING", pending: 10, sentToday: 100, yielding: false, now: wed9, cloud: true, cloudCap: 900 }).tone).toBe("ok");
  });
});
