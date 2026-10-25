import { describe, it, expect } from "vitest";
import { signUnsubscribeToken, verifyUnsubscribeToken } from "./unsubscribe-token";

const SECRET = "segredo-de-teste-com-tamanho-suficiente";

describe("unsubscribe token", () => {
  it("assina e verifica o id do consentimento", () => {
    const token = signUnsubscribeToken("cmconsent1234567890", SECRET);
    expect(verifyUnsubscribeToken(token, SECRET)).toBe("cmconsent1234567890");
  });

  it("é curto e seguro para URL (cabe em SMS)", () => {
    const token = signUnsubscribeToken("cmconsent1234567890", SECRET);
    expect(token.length).toBeLessThanOrEqual(45);
    expect(token).toMatch(/^[A-Za-z0-9_.-]+$/);
  });

  it("id adulterado invalida", () => {
    const token = signUnsubscribeToken("cmconsent1234567890", SECRET);
    const [, sig] = token.split(".");
    expect(verifyUnsubscribeToken(`outroid.${sig}`, SECRET)).toBeNull();
  });

  it("assinatura adulterada invalida", () => {
    const token = signUnsubscribeToken("cmconsent1234567890", SECRET);
    expect(verifyUnsubscribeToken(token.slice(0, -1) + (token.endsWith("a") ? "b" : "a"), SECRET)).toBeNull();
  });

  it("segredo diferente invalida", () => {
    const token = signUnsubscribeToken("cmconsent1234567890", SECRET);
    expect(verifyUnsubscribeToken(token, "outro-segredo-qualquer-123456789")).toBeNull();
  });

  it("lixo e vazio viram null, sem lançar erro", () => {
    for (const bad of ["", "abc", ".", "a.b.c", "%%%.%%%"]) {
      expect(verifyUnsubscribeToken(bad, SECRET)).toBeNull();
    }
  });

  it("sem segredo configurado, recusa assinar e recusa verificar", () => {
    expect(() => signUnsubscribeToken("x", "")).toThrow();
    expect(verifyUnsubscribeToken("a.b", "")).toBeNull();
  });
});
