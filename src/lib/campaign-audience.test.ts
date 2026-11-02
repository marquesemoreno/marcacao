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

describe("buildCampaignAudience — retorno (sem vir há X–Y meses)", () => {
  const base = { optedOutPhones: new Set<string>(), today };
  const retorno = (extra: Partial<{ minMonths: number; maxMonths: number; futurePhones: Set<string> }> = {}) => ({
    minMonths: 6,
    maxMonths: 12,
    futurePhones: new Set<string>(),
    ...extra,
  });

  it("entra quem teve a última marcação passada dentro da faixa", () => {
    const { recipients } = buildCampaignAudience([p({ ultimaPassada: "2026-01-15" })], { ...base, retorno: retorno() });
    expect(recipients).toHaveLength(1);
  });
  it("fora quem veio há pouco ou há tempo demais", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, telefone: "77991111111", ultimaPassada: "2026-08-20" }), p({ id: 2, telefone: "77992222222", ultimaPassada: "2024-01-10" })],
      { ...base, retorno: retorno() },
    );
    expect(recipients).toHaveLength(0);
    expect(stats.excludedRetornoRange).toBe(2);
  });
  it("fora quem já tem consulta futura (pelo código)", () => {
    const { recipients, stats } = buildCampaignAudience([p({ ultimaPassada: "2026-01-15", proximaMarcacao: "2026-10-20" })], { ...base, retorno: retorno() });
    expect(recipients).toHaveLength(0);
    expect(stats.excludedHasFuture).toBe(1);
  });
  it("fora quem já tem consulta futura marcada só pelo telefone (com ou sem 9º dígito)", () => {
    const { recipients, stats } = buildCampaignAudience([p({ telefone: "77991234567", ultimaPassada: "2026-01-15" })], {
      ...base,
      retorno: retorno({ futurePhones: new Set(["7791234567"]) }),
    });
    expect(recipients).toHaveLength(0);
    expect(stats.excludedHasFuture).toBe(1);
  });
  it("usa a última consulta ATENDIDA quando o sistema informa (clínica que preenche status)", () => {
    const { recipients } = buildCampaignAudience([p({ ultimaPassada: "2026-09-01", ultimaAtendida: "2026-02-01" })], { ...base, retorno: retorno() });
    expect(recipients).toHaveLength(1);
  });
  it("sem nenhuma data passada fica de fora", () => {
    const { stats } = buildCampaignAudience([p({ ultimaPassada: null })], { ...base, retorno: retorno() });
    expect(stats.excludedRetornoRange).toBe(1);
  });
});

describe("buildCampaignAudience — filtro por médico da última consulta", () => {
  const base = { optedOutPhones: new Set<string>(), today };
  it("só entra quem teve a última consulta com o médico escolhido (código sem espaços)", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, telefone: "77991111111", medicoUltima: "01 " }), p({ id: 2, telefone: "77992222222", medicoUltima: "02" }), p({ id: 3, telefone: "77993333333", medicoUltima: null })],
      { ...base, doctorIds: new Set(["01"]) },
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577991111111"]);
    expect(stats.excludedDoctor).toBe(2);
  });
  it("casa código com e sem zero à esquerda (\"04\" = 4)", () => {
    const { recipients } = buildCampaignAudience([p({ medicoUltima: "04" })], { ...base, doctorIds: new Set(["4"]) });
    expect(recipients).toHaveLength(1);
  });
  it("sem filtro de médico ninguém sai por isso", () => {
    const { stats } = buildCampaignAudience([p({ medicoUltima: "02" })], base);
    expect(stats.excludedDoctor).toBe(0);
  });
});

describe("buildCampaignAudience — régua (última consulta exatamente num dia)", () => {
  const base = { optedOutPhones: new Set<string>(), today };
  it("só entra quem teve a última consulta no dia pedido", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, telefone: "77991111111", ultimaPassada: "2026-09-30" }), p({ id: 2, telefone: "77992222222", ultimaPassada: "2026-09-29" })],
      { ...base, lastVisitOn: { date: "2026-09-30" } },
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577991111111"]);
    expect(stats.excludedRetornoRange).toBe(1);
  });
  it("prefere a última ATENDIDA quando existe", () => {
    const { recipients } = buildCampaignAudience([p({ ultimaPassada: "2026-09-30", ultimaAtendida: "2026-04-01" })], {
      ...base,
      lastVisitOn: { date: "2026-04-01" },
    });
    expect(recipients).toHaveLength(1);
  });
  it("com futurePhones, quem já tem consulta marcada fica de fora", () => {
    const { recipients, stats } = buildCampaignAudience([p({ ultimaPassada: "2026-04-01", proximaMarcacao: "2026-10-10" })], {
      ...base,
      lastVisitOn: { date: "2026-04-01", futurePhones: new Set() },
    });
    expect(recipients).toHaveLength(0);
    expect(stats.excludedHasFuture).toBe(1);
  });
  it("sem futurePhones (pós-consulta), consulta futura não tira ninguém", () => {
    const { recipients } = buildCampaignAudience([p({ ultimaPassada: "2026-09-30", proximaMarcacao: "2026-10-10" })], {
      ...base,
      lastVisitOn: { date: "2026-09-30" },
    });
    expect(recipients).toHaveLength(1);
  });
  it("data por paciente (intervalo de retorno por médico)", () => {
    const { recipients } = buildCampaignAudience(
      [
        p({ id: 1, telefone: "77991111111", ultimaPassada: "2026-07-01", medicoUltima: "12" }),
        p({ id: 2, telefone: "77992222222", ultimaPassada: "2026-07-01", medicoUltima: "7" }),
        p({ id: 3, telefone: "77993333333", ultimaPassada: "2026-04-01", medicoUltima: "7" }),
      ],
      { ...base, lastVisitOn: { date: (pt) => (pt.medicoUltima === "12" ? "2026-07-01" : "2026-04-01") } },
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577991111111", "5577993333333"]);
  });
});

describe("buildCampaignAudience — aniversário", () => {
  const base = { optedOutPhones: new Set<string>(), today };
  it("só entra quem faz aniversário no dia (MM-DD)", () => {
    const { recipients, stats } = buildCampaignAudience(
      [p({ id: 1, telefone: "77991111111", nascimento: "1980-10-01" }), p({ id: 2, telefone: "77992222222", nascimento: "1980-10-02" })],
      { ...base, birthdayOn: "10-01" },
    );
    expect(recipients.map((r) => r.phone)).toEqual(["5577991111111"]);
    expect(stats.excludedNotBirthday).toBe(1);
  });
  it("sem data de nascimento fica de fora", () => {
    const { stats } = buildCampaignAudience([p({ nascimento: null })], { ...base, birthdayOn: "10-01" });
    expect(stats.excludedNotBirthday).toBe(1);
  });
});
