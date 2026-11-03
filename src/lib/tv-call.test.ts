import { describe, expect, it } from "vitest";
import { doctorKey, pushCallHistory, resolveRoom, tvDisplayName, tvSpokenName, tvSpokenText } from "./tv-call";

describe("tvDisplayName (o que aparece na TV — LGPD: primeiro nome + inicial)", () => {
  it("primeiro nome e inicial do último sobrenome", () => {
    expect(tvDisplayName("LUCAS MARQUES MORENO")).toBe("Lucas M.");
    expect(tvDisplayName("maria da silva")).toBe("Maria S.");
  });
  it("nome único fica como está; vazio vira 'Paciente'", () => {
    expect(tvDisplayName("Joana")).toBe("Joana");
    expect(tvDisplayName("   ")).toBe("Paciente");
  });
});

describe("tvSpokenName (o que a voz fala: primeiro + último nome)", () => {
  it("pula partículas no fim", () => {
    expect(tvSpokenName("LUCAS MARQUES MORENO")).toBe("Lucas Moreno");
    expect(tvSpokenName("Ana Maria dos")).toBe("Ana Maria");
    expect(tvSpokenName("Joana")).toBe("Joana");
  });
});

describe("tvSpokenText", () => {
  it("consultório: 'ao'", () => {
    expect(tvSpokenText({ spokenName: "Lucas Moreno", room: "Consultório 03" })).toBe("Paciente Lucas Moreno, favor dirigir-se ao Consultório 03.");
  });
  it("sala: 'à'", () => {
    expect(tvSpokenText({ spokenName: "Ana", room: "Sala 2" })).toBe("Paciente Ana, favor dirigir-se à Sala 2.");
  });
  it("sem sala: recepção", () => {
    expect(tvSpokenText({ spokenName: "Ana", room: null })).toBe("Paciente Ana, favor dirigir-se à recepção.");
  });
});

describe("doctorKey / resolveRoom", () => {
  it("normaliza o nome do médico (caixa, acento, espaços)", () => {
    expect(doctorKey("  Dr. NÍLTON  Coutinho ")).toBe("dr. nilton coutinho");
  });
  it("troca na hora > sala fixa do médico > nenhuma", () => {
    const rooms = new Map([["nilton coutinho", "Consultório 03"]]);
    expect(resolveRoom(rooms, "NILTON COUTINHO", null)).toBe("Consultório 03");
    expect(resolveRoom(rooms, "Nilton Coutinho", " Sala 5 ")).toBe("Sala 5");
    expect(resolveRoom(rooms, "Outro", null)).toBeNull();
    expect(resolveRoom(rooms, null, null)).toBeNull();
  });
});

describe("pushCallHistory", () => {
  const c = (id: string) => ({ id });
  it("mais recente primeiro, sem repetir id, no máximo 5", () => {
    let h: { id: string }[] = [];
    for (const id of ["1", "2", "3", "4", "5", "6"]) h = pushCallHistory(h, c(id));
    expect(h.map((x) => x.id)).toEqual(["6", "5", "4", "3", "2"]);
    expect(pushCallHistory(h, c("4")).map((x) => x.id)).toEqual(["4", "6", "5", "3", "2"]);
  });
});
