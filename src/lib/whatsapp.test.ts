import { describe, it, expect } from "vitest";
import { isValidWhatsAppNumber } from "./whatsapp";

describe("isValidWhatsAppNumber", () => {
  it("aceita um celular brasileiro completo (DDI + DDD + 9 dígitos)", () => {
    expect(isValidWhatsAppNumber("5573999116828")).toBe(true);
  });

  it("rejeita número sem DDI, mesmo com o total de dígitos parecido", () => {
    // Bug real de produção: telefone cadastrado manualmente com um dígito a mais
    // e sem o "55" na frente ("779911982441", 12 dígitos) passava despercebido
    // pela checagem antiga (`fullPhone.length < 12`), e toda tentativa de envio
    // pra esse contato falhava na Evolution API com HTTP 400.
    expect(isValidWhatsAppNumber("779911982441")).toBe(false);
  });

  it("rejeita número curto demais (sem DDD nem DDI)", () => {
    expect(isValidWhatsAppNumber("991198244")).toBe(false);
  });

  it("rejeita número longo demais", () => {
    expect(isValidWhatsAppNumber("55779911982441")).toBe(false);
  });

  it("aceita e normaliza número sem o DDI, corrigido por formatToWhatsAppNumber", () => {
    expect(isValidWhatsAppNumber("77988411342")).toBe(true);
  });
});
