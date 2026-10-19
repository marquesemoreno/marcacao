import { describe, expect, it } from "vitest";
import { campaignLabel, groupByCampaign, computeCampaignReport, NO_CAMPAIGN } from "./crm-campaigns";

describe("campaignLabel", () => {
  it("canal + campanha, só canal, ou sem origem", () => {
    expect(campaignLabel("Instagram Ads", "Check-up Outubro")).toBe("Instagram Ads · Check-up Outubro");
    expect(campaignLabel("Site da Clínica", "vasectomia")).toBe("Site da Clínica · vasectomia");
    expect(campaignLabel("Google Ads", null)).toBe("Google Ads");
    expect(campaignLabel(null, null)).toBe(NO_CAMPAIGN);
  });
});

describe("groupByCampaign", () => {
  it("agrupa e ordena colunas por quantidade, 'sem origem' por último", () => {
    const items = [
      { id: "1", acquisitionChannel: "Site da Clínica", acquisitionDetail: "vasectomia" },
      { id: "2", acquisitionChannel: null, acquisitionDetail: null },
      { id: "3", acquisitionChannel: "Site da Clínica", acquisitionDetail: "vasectomia" },
      { id: "4", acquisitionChannel: "Instagram Ads", acquisitionDetail: "Check-up" },
      { id: "5", acquisitionChannel: null, acquisitionDetail: null },
      { id: "6", acquisitionChannel: null, acquisitionDetail: null },
    ];
    const cols = groupByCampaign(items);
    expect(cols.map((c) => [c.label, c.items.length])).toEqual([
      ["Site da Clínica · vasectomia", 2],
      ["Instagram Ads · Check-up", 1],
      [NO_CAMPAIGN, 3],
    ]);
  });
});

describe("computeCampaignReport", () => {
  const conv = (channel: string | null, detail: string | null, status: string, reason: string | null) => ({
    acquisitionChannel: channel,
    acquisitionDetail: detail,
    status,
    resolutionReason: reason,
  });
  it("leads, agendaram, conversão sem inatividade, receita e custo com investimento informado", () => {
    const rows = computeCampaignReport(
      [
        conv("Google Ads", "vasectomia", "RESOLVED", "AGENDAMENTO_CONCLUIDO"),
        conv("Google Ads", "vasectomia", "RESOLVED", "PERDA_PRECO"),
        conv("Google Ads", "vasectomia", "RESOLVED", "INATIVIDADE"),
        conv("Google Ads", "vasectomia", "OPEN", null),
        conv("Site da Clínica", null, "RESOLVED", "AGENDAMENTO_CONCLUIDO"),
      ],
      250,
      { "Google Ads · vasectomia": 400 }
    );
    expect(rows[0]).toEqual({
      label: "Google Ads · vasectomia",
      channel: "Google Ads",
      leads: 4,
      scheduled: 1,
      conversionRate: 50,
      revenue: 250,
      spend: 400,
      costPerLead: 100,
      costPerScheduled: 400,
      roi: -37.5,
    });
    expect(rows[1]).toMatchObject({ label: "Site da Clínica", leads: 1, spend: null, costPerLead: null, roi: null });
  });
});
