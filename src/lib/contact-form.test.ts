import { describe, it, expect } from "vitest";
import { maskWhatsAppInput, whatsAppInputError, normalizeWhatsAppInput, maskCpfInput, cpfInputError } from "./contact-form";

describe("maskWhatsAppInput", () => {
  it("formata progressivamente como (77) 9 9999-9999", () => {
    expect(maskWhatsAppInput("7")).toBe("(7");
    expect(maskWhatsAppInput("77")).toBe("(77");
    expect(maskWhatsAppInput("779")).toBe("(77) 9");
    expect(maskWhatsAppInput("7799123")).toBe("(77) 9 9123");
    expect(maskWhatsAppInput("77991234567")).toBe("(77) 9 9123-4567");
  });
  it("tira o 55 colado e ignora dígitos a mais", () => {
    expect(maskWhatsAppInput("5577991234567")).toBe("(77) 9 9123-4567");
    expect(maskWhatsAppInput("779912345678")).toBe("(77) 9 9123-4567");
  });
});

describe("whatsAppInputError", () => {
  it("aceita celular com DDD + 9 dígitos", () => {
    expect(whatsAppInputError("(77) 9 9123-4567")).toBeNull();
  });
  it("mensagens de erro em linha", () => {
    expect(whatsAppInputError("")).toBe("Informe o WhatsApp com DDD.");
    expect(whatsAppInputError("(77) 9 9123")).toBe("Número incompleto: são o DDD + 9 dígitos.");
    expect(whatsAppInputError("(07) 9 9123-4567")).toBe("DDD inválido.");
    expect(whatsAppInputError("(77) 3 4216-4070")).toBe("Celular deve começar com 9 depois do DDD.");
  });
});

describe("normalizeWhatsAppInput", () => {
  it("vira 55 + DDD + número", () => {
    expect(normalizeWhatsAppInput("(77) 9 9123-4567")).toBe("5577991234567");
  });
});

describe("CPF", () => {
  it("máscara 000.000.000-00", () => {
    expect(maskCpfInput("52998224725")).toBe("529.982.247-25");
    expect(maskCpfInput("5299")).toBe("529.9");
  });
  it("valida dígitos verificadores; vazio é opcional", () => {
    expect(cpfInputError("")).toBeNull();
    expect(cpfInputError("529.982.247-25")).toBeNull();
    expect(cpfInputError("529.982.247-24")).toBe("CPF inválido.");
    expect(cpfInputError("529.982")).toBe("CPF incompleto.");
  });
});
