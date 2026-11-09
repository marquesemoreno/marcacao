import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, bridge } = vi.hoisted(() => ({
  bridge: { fetchBridgeCampaignPatients: vi.fn() },
  prismaMock: {
    automationRule: { findMany: vi.fn(), update: vi.fn() },
    whatsappCloudAccount: { findUnique: vi.fn() },
    hospitalIntegration: { findUnique: vi.fn() },
    contact: { findMany: vi.fn() },
    broadcastRecipient: { findMany: vi.fn() },
    broadcastCampaign: { create: vi.fn() },
    user: { findFirst: vi.fn() },
    webhookLog: { create: vi.fn() },
    returnInterval: { findMany: vi.fn() },
    agendaMark: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/hospital-bridge", () => bridge);

import { runAutomationRules } from "./automation-rules-run";

const now = new Date("2026-11-02T11:00:00Z"); // 08h de 02/11 em Brasília
const rule = {
  id: "r1",
  clinicId: "c1",
  kind: "POS_CONSULTA",
  name: "Pós-consulta",
  daysAfter: 1,
  requireNoFuture: false,
  messageTemplate: "Oi {{nome}}",
  cloudTemplateName: "pos_consulta",
  cloudTemplateLanguage: "pt_BR",
  cloudTemplateBody: "Oi {{1}}",
  cloudTemplateParams: ["{{nome}}"],
  active: true,
  lastRunDate: null,
  clinic: { technicalDirectorName: "Dr. X", technicalDirectorCrm: "CRM-BA 1", campaignExcludedPatientIds: [] },
};
const patient = (id: number, telefone: string, ultimaPassada: string) => ({
  id,
  nome: "MARIA SILVA",
  telefone,
  nascimento: "1980-01-01",
  ultimaMarcacao: ultimaPassada,
  ultimaPassada,
  proximaMarcacao: null,
});

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.automationRule.findMany.mockResolvedValue([rule]);
  prismaMock.whatsappCloudAccount.findUnique.mockResolvedValue({ active: true });
  prismaMock.hospitalIntegration.findUnique.mockResolvedValue({ active: true });
  prismaMock.contact.findMany.mockResolvedValue([]);
  prismaMock.broadcastRecipient.findMany.mockResolvedValue([]);
  prismaMock.user.findFirst.mockResolvedValue({ id: "u1" });
  prismaMock.webhookLog.create.mockResolvedValue({});
  prismaMock.returnInterval.findMany.mockResolvedValue([]);
  bridge.fetchBridgeCampaignPatients.mockResolvedValue({
    patients: [patient(1, "77991111111", "2026-11-01"), patient(2, "77992222222", "2026-10-30")],
    futurePhones: [],
  });
});

describe("runAutomationRules", () => {
  it("cria campanha RUNNING de baixa prioridade só com quem consultou ontem", async () => {
    const [r] = await runAutomationRules(now);
    expect(r.status).toBe("criada");
    expect(bridge.fetchBridgeCampaignPatients).toHaveBeenCalledWith("c1", { desde: "2026-11-01" });
    const data = prismaMock.broadcastCampaign.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ status: "RUNNING", lowPriority: true, automationRuleId: "r1", cloudTemplateName: "pos_consulta", name: "Régua · Pós-consulta · 02/11" });
    expect(data.recipients.create.map((x: { phone: string }) => x.phone)).toEqual(["5577991111111"]);
    expect(prismaMock.automationRule.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { lastRunDate: "2026-11-02" } });
  });

  it("pula a clínica demo — nada é criado nem enviado", async () => {
    prismaMock.automationRule.findMany.mockResolvedValue([{ ...rule, clinic: { ...rule.clinic, cnpj: "00.000.000/0001-00" } }]);
    const results = await runAutomationRules(now);
    expect(results).toEqual([]);
    expect(bridge.fetchBridgeCampaignPatients).not.toHaveBeenCalled();
    expect(prismaMock.broadcastCampaign.create).not.toHaveBeenCalled();
  });

  it("Retorno usa o intervalo do médico da última consulta (padrão = daysAfter)", async () => {
    prismaMock.automationRule.findMany.mockResolvedValue([{ ...rule, kind: "RETORNO", name: "Retorno", daysAfter: 180, requireNoFuture: true }]);
    prismaMock.returnInterval.findMany.mockResolvedValue([{ kind: "DOCTOR", key: "12", label: "Dr. A", days: 90 }]);
    bridge.fetchBridgeCampaignPatients.mockResolvedValue({
      patients: [
        { ...patient(1, "77991111111", "2026-08-04"), medicoUltima: "12" }, // 90 dias, médico 12
        { ...patient(2, "77992222222", "2026-08-04"), medicoUltima: "7" }, // 90 dias, mas médico 7 usa 180
        { ...patient(3, "77993333333", "2026-05-06"), medicoUltima: "7" }, // 180 dias
      ],
      futurePhones: [],
    });
    await runAutomationRules(now);
    expect(bridge.fetchBridgeCampaignPatients).toHaveBeenCalledWith("c1", { desde: "2026-05-06" });
    const data = prismaMock.broadcastCampaign.create.mock.calls[0][0].data;
    expect(data.recipients.create.map((x: { phone: string }) => x.phone)).toEqual(["5577991111111", "5577993333333"]);
  });

  it("sem API oficial ativa não cria nada", async () => {
    prismaMock.whatsappCloudAccount.findUnique.mockResolvedValue({ active: false });
    const [r] = await runAutomationRules(now);
    expect(r.status).toBe("sem API oficial ativa");
    expect(prismaMock.broadcastCampaign.create).not.toHaveBeenCalled();
  });

  it("não repete quem já recebeu este passo nos últimos 30 dias", async () => {
    prismaMock.broadcastRecipient.findMany.mockResolvedValue([{ phone: "5577991111111" }]);
    const [r] = await runAutomationRules(now);
    expect(r.status).toBe("ninguém hoje");
    expect(prismaMock.broadcastCampaign.create).not.toHaveBeenCalled();
  });

  it("erro do bridge vira status e não derruba os outros passos", async () => {
    bridge.fetchBridgeCampaignPatients.mockRejectedValue(new Error("bridge fora do ar"));
    const [r] = await runAutomationRules(now);
    expect(r.status).toBe("erro: bridge fora do ar");
    expect(prismaMock.automationRule.update).toHaveBeenCalled();
  });
});

describe("ruleAudience (prévia da régua)", () => {
  it("conta quem receberia amanhã com os dias escolhidos, mesmo sem regra salva", async () => {
    const { ruleAudience } = await import("./automation-rules-run");
    const tomorrow = new Date("2026-11-03T11:00:00Z");
    bridge.fetchBridgeCampaignPatients.mockResolvedValue({
      patients: [patient(1, "77991111111", "2026-11-02"), patient(2, "77992222222", "2026-11-01")],
      futurePhones: [],
    });
    const r = await ruleAudience({ clinicId: "c1", ruleId: null, kind: "POS_CONSULTA", daysAfter: 1, requireNoFuture: false, excludedPatientIds: [] }, tomorrow);
    expect(bridge.fetchBridgeCampaignPatients).toHaveBeenCalledWith("c1", { desde: "2026-11-02" });
    expect(r.map((x) => x.phone)).toEqual(["5577991111111"]);
    expect(prismaMock.broadcastRecipient.findMany).not.toHaveBeenCalled();
  });
});

describe("runAutomationRules — aniversário", () => {
  it("pega pacientes ativos dos últimos 2 anos e manda para quem faz aniversário hoje", async () => {
    prismaMock.automationRule.findMany.mockResolvedValue([{ ...rule, id: "r2", kind: "ANIVERSARIO", name: "Aniversário", daysAfter: 0 }]);
    bridge.fetchBridgeCampaignPatients.mockResolvedValue({
      patients: [
        { ...patient(1, "77991111111", "2026-01-10"), nascimento: "1975-11-02" },
        { ...patient(2, "77992222222", "2026-01-10"), nascimento: "1975-11-03" },
      ],
      futurePhones: [],
    });
    const [r] = await runAutomationRules(now);
    expect(r.status).toBe("criada");
    expect(bridge.fetchBridgeCampaignPatients).toHaveBeenCalledWith("c1", { desde: "2024-11-02" });
    const data = prismaMock.broadcastCampaign.create.mock.calls[0][0].data;
    expect(data.recipients.create.map((x: { phone: string }) => x.phone)).toEqual(["5577991111111"]);
  });
});
