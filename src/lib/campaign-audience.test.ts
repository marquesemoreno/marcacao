import { describe, it, expect } from "vitest";
import { buildCampaignAudience, type BridgeCampaignPatient } from "./campaign-audience";

const today = new Date("2026-10-01T12:00:00Z");
const p = (partial: Partial<BridgeCampaignPatient>): BridgeCampaignPatient => ({
  id: 1,
  nome: "MARIA DAS GRACAS SILVA",
  telefone: "77991234567",
  nascimento: "1980-05-10",
  ultimaMarcacao: "2026-08-01",
  ...partial,
});

describe("buildCampaignAudience", () => {
  it("primeiro nome em title case e saudação com nome", () => {
    const { recipients } = buildCampaignAudience([p({})], { minAge: 18, optedOutPhones: new Set(), today });
    expect(recipients).toEqual([
      { phone: "5577991234567", variables: { nome: "Maria", saudacao: "Oi, Maria" } },
    ]);
  });

  it("número compartilhado entre pacientes: um envio só, sem nome", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, nome: "ANA SOUZA" }), p({ id: 2, nome: "JULIA SOUZA", telefone: "(77) 99123-4567" })],
      { minAge: 18, optedOutPhones: new Set(), today }
    );
    expect(recipients).toEqual([{ phone: "5577991234567", variables: { nome: "", saudacao: "Oi" } }]);
    expect(stats.sharedPhones).toBe(1);
  });

  it("menor de idade e sem data de nascimento ficam de fora quando há idade mínima", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, nascimento: "2014-01-01" }), p({ id: 2, nascimento: null, telefone: "77988887777" })],
      { minAge: 18, optedOutPhones: new Set(), today }
    );
    expect(recipients).toEqual([]);
    expect(stats.excludedAge).toBe(1);
    expect(stats.excludedNoBirthDate).toBe(1);
  });

  it("idade máxima e sem idade mínima (sem nascimento entra)", () => {
    const { recipients } = buildCampaignAudience(
      [p({ id: 1, nascimento: "1950-01-01" }), p({ id: 2, nascimento: null, telefone: "77988887777" })],
      { maxAge: 60, optedOutPhones: new Set(), today }
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577988887777"]);
  });

  it("menor com o mesmo celular de uma adulta não derruba o nome da adulta", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, nome: "ANA SOUZA" }), p({ id: 2, nome: "BIA SOUZA", nascimento: "2015-01-01" })],
      { minAge: 18, optedOutPhones: new Set(), today }
    );
    expect(recipients).toEqual([{ phone: "5577991234567", variables: { nome: "Ana", saudacao: "Oi, Ana" } }]);
    expect(stats.sharedPhones).toBe(0);
  });

  it("respeita opt-out (com e sem 9º dígito) e descarta telefone inválido", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1 }), p({ id: 2, telefone: "123" }), p({ id: 3, telefone: "77988887777" })],
      { optedOutPhones: new Set(["557788887777"]), today }
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577991234567"]);
    expect(stats.optedOut).toBe(1);
    expect(stats.invalidPhone).toBe(1);
  });

  it("stats.total conta pacientes recebidos do bridge", () => {
    expect(buildCampaignAudience([p({}), p({ id: 2 })], { optedOutPhones: new Set(), today }).stats.total).toBe(2);
  });
});

describe("buildCampaignAudience — lista de exclusão", () => {
  it("tira pacientes pelo código do sistema da clínica e conta à parte", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 10 }), p({ id: 11, telefone: "77988887777" })],
      { optedOutPhones: new Set(), excludedPatientIds: new Set([10]), today }
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577988887777"]);
    expect(stats.excludedManual).toBe(1);
  });
});
