import { describe, it, expect } from "vitest";
import {
  cloudBatchSize,
  campaignSituation,
  estimateCampaignFinish,
  CLOUD_PER_MINUTE,
  CLOUD_DAILY_CAP,
} from "./broadcast-schedule";

// Quarta, 25/11/2026, 09:00 de Brasília (12:00 UTC).
const wed9 = new Date("2026-11-25T12:00:00Z");

describe("cloudBatchSize (API oficial)", () => {
  it(`manda até ${CLOUD_PER_MINUTE} por minuto`, () => {
    expect(cloudBatchSize({ sentToday: 0, pending: 500 })).toBe(CLOUD_PER_MINUTE);
  });
  it("não passa do que está na fila", () => {
    expect(cloudBatchSize({ sentToday: 0, pending: 2 })).toBe(2);
  });
  it(`respeita o limite diário da clínica (${CLOUD_DAILY_CAP})`, () => {
    expect(cloudBatchSize({ sentToday: CLOUD_DAILY_CAP - 5, pending: 500 })).toBe(5);
    expect(cloudBatchSize({ sentToday: CLOUD_DAILY_CAP, pending: 500 })).toBe(0);
    expect(cloudBatchSize({ sentToday: CLOUD_DAILY_CAP + 3, pending: 500 })).toBe(0);
  });
});

describe("estimateCampaignFinish com API oficial", () => {
  it("2 destinatários às 9h terminam hoje", () => {
    expect(estimateCampaignFinish({ pending: 2, sentToday: 0, now: wed9, cloud: true })).toEqual({ businessDays: 1, finishIso: "2026-11-25" });
  });
  it("2.849 (Novembro Azul) levam 3 dias úteis no limite diário", () => {
    expect(estimateCampaignFinish({ pending: 2849, sentToday: 0, now: wed9, cloud: true })).toEqual({ businessDays: 3, finishIso: "2026-11-27" });
  });
  it("sem a API oficial, segue o ritmo antigo (mais lento)", () => {
    expect(estimateCampaignFinish({ pending: 2849, sentToday: 0, now: wed9 }).businessDays).toBeGreaterThan(3);
  });
});

describe("campaignSituation com API oficial", () => {
  it("fala do ritmo da API oficial", () => {
    expect(campaignSituation({ status: "RUNNING", pending: 10, sentToday: 0, yielding: false, now: wed9, cloud: true }).text).toMatch(/API oficial/);
  });
  it("limite diário da API oficial", () => {
    const s = campaignSituation({ status: "RUNNING", pending: 10, sentToday: CLOUD_DAILY_CAP, yielding: false, now: wed9, cloud: true });
    expect(s.tone).toBe("wait");
    expect(s.text).toContain(String(CLOUD_DAILY_CAP));
  });
  it("100 enviadas hoje não travam a campanha da API oficial", () => {
    expect(campaignSituation({ status: "RUNNING", pending: 10, sentToday: 100, yielding: false, now: wed9, cloud: true }).tone).toBe("ok");
  });
});
