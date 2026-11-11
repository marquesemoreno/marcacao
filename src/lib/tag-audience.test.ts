import { describe, expect, it } from "vitest";
import { buildTagAudience, countTagAudiences, type TaggedConversation } from "./tag-audience";
import { NON_PATIENT_TAG, WRONG_NUMBER_TAG } from "./conversation-tags";

const conv = (phone: string | null, name: string, tags: string[]): TaggedConversation => ({ phone, name, tags });

describe("countTagAudiences", () => {
  it("conta pacientes por tag, da mais usada para a menos usada", () => {
    const rows = [
      conv("5577900000001", "Ana Lima", ["Natação", "Fisioterapia"]),
      conv("5577900000002", "Bruno Reis", ["Natação"]),
      conv("5577900000003", "Carla Souza", ["Palmilhas"]),
    ];
    expect(countTagAudiences(rows)).toEqual([
      { tag: "Natação", count: 2 },
      { tag: "Fisioterapia", count: 1 },
      { tag: "Palmilhas", count: 1 },
    ]);
  });

  it("conta o mesmo telefone uma vez só, mesmo com duas conversas na tag", () => {
    const rows = [conv("5577900000001", "Ana Lima", ["Natação"]), conv("5577900000001", "Ana Lima", ["Natação"])];
    expect(countTagAudiences(rows)).toEqual([{ tag: "Natação", count: 1 }]);
  });

  it("ignora contato sem telefone (Instagram) e quem está como número errado", () => {
    const rows = [
      conv(null, "perfil_insta", ["Natação"]),
      conv("5577900000002", "Bruno Reis", ["Natação", WRONG_NUMBER_TAG]),
      conv("5577900000003", "Carla Souza", ["Natação"]),
    ];
    expect(countTagAudiences(rows)).toEqual([{ tag: "Natação", count: 1 }]);
  });

  it("número errado em uma conversa tira o telefone também das outras", () => {
    const rows = [conv("5577900000002", "Bruno Reis", ["Natação"]), conv("5577900000002", "Bruno Reis", [WRONG_NUMBER_TAG])];
    expect(countTagAudiences(rows)).toEqual([]);
  });

  it("quem não é paciente só aparece na própria tag 'Não é paciente'", () => {
    const rows = [conv("5577900000004", "Fornecedor X", ["Parceiros", NON_PATIENT_TAG]), conv("5577900000005", "Dora Paz", ["Parceiros"])];
    expect(countTagAudiences(rows)).toEqual([
      { tag: "Parceiros", count: 1 },
      { tag: NON_PATIENT_TAG, count: 1 },
    ]);
  });

  it("nunca oferece 'Número errado' como público", () => {
    expect(countTagAudiences([conv("5577900000002", "Bruno Reis", [WRONG_NUMBER_TAG])])).toEqual([]);
  });
});

describe("buildTagAudience", () => {
  it("monta os destinatários da tag com primeiro nome e saudação", () => {
    const rows = [conv("5577900000001", "Ana Lima", ["Natação"]), conv("5577900000003", "Carla Souza", ["Palmilhas"])];
    expect(buildTagAudience(rows, "Natação")).toEqual([{ phone: "5577900000001", variables: { nome: "Ana", saudacao: "Oi, Ana" } }]);
  });

  it("sem nome utilizável, a saudação fica só 'Oi'", () => {
    const rows = [conv("5577900000001", "5577900000001", ["Natação"])];
    expect(buildTagAudience(rows, "Natação")).toEqual([{ phone: "5577900000001", variables: { nome: "", saudacao: "Oi" } }]);
  });

  it("não repete telefone e respeita número errado e não paciente", () => {
    const rows = [
      conv("5577900000001", "Ana Lima", ["Natação"]),
      conv("5577900000001", "Ana Lima", ["Natação"]),
      conv("5577900000002", "Bruno Reis", ["Natação", WRONG_NUMBER_TAG]),
      conv("5577900000004", "Fornecedor X", ["Natação", NON_PATIENT_TAG]),
      conv(null, "perfil_insta", ["Natação"]),
    ];
    expect(buildTagAudience(rows, "Natação").map((r) => r.phone)).toEqual(["5577900000001"]);
  });

  it("a tag 'Não é paciente' traz justamente quem não é paciente", () => {
    const rows = [conv("5577900000004", "Fornecedor Xavier", [NON_PATIENT_TAG])];
    expect(buildTagAudience(rows, NON_PATIENT_TAG).map((r) => r.phone)).toEqual(["5577900000004"]);
  });
});
