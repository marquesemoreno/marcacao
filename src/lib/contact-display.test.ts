import { describe, it, expect } from "vitest";
import { formatPhone } from "./format";
import { displayName, isUsableContactName } from "./contact-display";

describe("formatPhone", () => {
  it("formata número com DDI 55 (formato salvo no banco)", () => {
    expect(formatPhone("5577991234567")).toBe("(77) 99123-4567");
    expect(formatPhone("557734216407")).toBe("(77) 3421-6407");
  });
  it("mantém o comportamento de máscara de digitação (sem 55)", () => {
    expect(formatPhone("77991234567")).toBe("(77) 99123-4567");
    expect(formatPhone("7799")).toBe("7799"); // digitação parcial: comportamento antigo mantido
    expect(formatPhone("(77) 99123-4567")).toBe("(77) 99123-4567");
  });
});

describe("isUsableContactName", () => {
  it("rejeita vazio, só pontuação/emoji, '?' e id numérico longo (LID/telefone)", () => {
    for (const bad of ["", "   ", "?", "..", "☘️", "✨ 🦋", "123456789012345", "5577991234567"]) {
      expect(isUsableContactName(bad)).toBe(false);
    }
  });
  it("aceita nome com letras, mesmo com emoji junto", () => {
    expect(isUsableContactName("Fatima 🦋")).toBe(true);
    expect(isUsableContactName("gs")).toBe(true);
    expect(isUsableContactName("Ana Maria")).toBe(true);
  });
});

describe("displayName", () => {
  it("usa o nome quando é válido", () => {
    expect(displayName({ name: "Ana Maria", phone: "5577991234567" })).toBe("Ana Maria");
  });
  it("nome inválido cai no telefone formatado", () => {
    expect(displayName({ name: "☘️", phone: "5577991234567" })).toBe("(77) 99123-4567");
    expect(displayName({ name: "5577991234567", phone: "5577991234567" })).toBe("(77) 99123-4567");
  });
  it("sem telefone (só LID) e sem nome válido", () => {
    expect(displayName({ name: "123456789012345", phone: null })).toBe("Contato sem número visível");
  });
  it("lead do Instagram sem nome usa o @", () => {
    expect(displayName({ name: "", phone: null, instagramUsername: "maria.s" })).toBe("@maria.s");
  });
});
