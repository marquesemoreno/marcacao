import { describe, expect, it } from "vitest";
import {
  buildMarcadorLink,
  cleanMarcadorName,
  extractMarcadorCode,
  makeMarcadorCode,
  parseMarcadorList,
  phoneTail,
  summarizeMarcadores,
} from "./marcadores";

describe("cleanMarcadorName", () => {
  it("tira 'Marcador(a)' e variações do nome do contato", () => {
    expect(cleanMarcadorName("Ailton Freitas Marcador")).toBe("Ailton Freitas");
    expect(cleanMarcadorName("Lene Marcadora")).toBe("Lene");
    expect(cleanMarcadorName("Ana Paula Marc")).toBe("Ana Paula");
    expect(cleanMarcadorName("Luis Carlos Marcardor")).toBe("Luis Carlos");
    expect(cleanMarcadorName("Ana Lucia Marcodora - Saude Med Barra")).toBe("Ana Lucia - Saude Med Barra");
    expect(cleanMarcadorName("Mais Saúde")).toBe("Mais Saúde");
  });
});

describe("makeMarcadorCode", () => {
  it("código curto sem acento, único", () => {
    expect(makeMarcadorCode("Ailton Freitas", new Set())).toBe("ailton");
    expect(makeMarcadorCode("Mais Saúde", new Set())).toBe("maissaude");
    expect(makeMarcadorCode("Ailton Souza", new Set(["ailton"]))).toBe("ailton2");
  });
});

describe("extractMarcadorCode", () => {
  it("acha #m-codigo no texto da 1ª mensagem", () => {
    expect(extractMarcadorCode("Olá! Fui indicado(a) por Lene (#m-lene)")).toBe("lene");
    expect(extractMarcadorCode("oi #M-MaisSaude2 quero marcar")).toBe("maissaude2");
    expect(extractMarcadorCode("oi, quero marcar")).toBeNull();
  });
});

describe("buildMarcadorLink", () => {
  it("wa.me com texto pré-preenchido", () => {
    const url = buildMarcadorLink("557734221010", { name: "Lene", code: "lene" });
    expect(url.startsWith("https://wa.me/557734221010?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe("Olá! Fui indicado(a) por Lene (#m-lene)");
  });
  it("número com DDD sem 55 ganha o código do país", () => {
    expect(buildMarcadorLink("(77) 98800-1010", { name: "Lene", code: "lene" }).startsWith("https://wa.me/5577988001010?")).toBe(true);
  });
});

describe("parseMarcadorList", () => {
  it("lê 'Nome – telefone' por linha e ignora repetidos pelo telefone", () => {
    const rows = parseMarcadorList("Lene Marcadora - (77) 8831-4115\nBeto;77 9868-6005\n\nLene de novo 557788314115");
    expect(rows).toEqual([
      { name: "Lene", phone: "557788314115" },
      { name: "Beto", phone: "557798686005" },
    ]);
  });
});

describe("phoneTail", () => {
  it("últimos 8 dígitos (casa com ou sem 9º dígito)", () => {
    expect(phoneTail("5577988314115")).toBe("88314115");
    expect(phoneTail("557788314115")).toBe("88314115");
  });
});

describe("summarizeMarcadores", () => {
  it("indicados, agendados, atendidos e conversão por marcador", () => {
    const rows = summarizeMarcadores(
      [{ id: "a", name: "Lene" }, { id: "b", name: "Beto" }],
      [
        { marcadorId: "a", scheduled: true, attended: true },
        { marcadorId: "a", scheduled: true, attended: false },
        { marcadorId: "a", scheduled: false, attended: false },
        { marcadorId: "b", scheduled: false, attended: false },
      ]
    );
    expect(rows[0]).toEqual({ id: "a", name: "Lene", referred: 3, scheduled: 2, attended: 1, conversion: 2 / 3 });
    expect(rows[1]).toEqual({ id: "b", name: "Beto", referred: 1, scheduled: 0, attended: 0, conversion: 0 });
  });
});
