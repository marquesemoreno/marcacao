import { describe, it, expect } from "vitest";
import { mentionsInvoiceRequest } from "./chat-messages";

describe("mentionsInvoiceRequest", () => {
  it("reconhece 'nota fiscal' em qualquer posição, sem diferenciar maiúsculas", () => {
    expect(mentionsInvoiceRequest("Preciso de uma nota fiscal, pode emitir?")).toBe(true);
    expect(mentionsInvoiceRequest("Vocês emitem NOTA FISCAL?")).toBe(true);
    expect(mentionsInvoiceRequest("gostaria da Nota Fiscal da consulta de ontem")).toBe(true);
  });

  it("não reconhece mensagens sem menção a nota fiscal", () => {
    expect(mentionsInvoiceRequest("Bom dia, qual o horário de vocês?")).toBe(false);
    expect(mentionsInvoiceRequest("Preciso de um recibo")).toBe(false);
    expect(mentionsInvoiceRequest("")).toBe(false);
  });
});
