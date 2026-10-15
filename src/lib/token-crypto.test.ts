import { describe, expect, it, beforeAll } from "vitest";
import { decryptToken, encryptToken, isEncryptedToken } from "./token-crypto";

beforeAll(() => {
  process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
});

describe("token-crypto", () => {
  it("criptografa e volta ao original", () => {
    const enc = encryptToken("EAAG-segredo-123");
    expect(enc).not.toContain("EAAG");
    expect(isEncryptedToken(enc)).toBe(true);
    expect(decryptToken(enc)).toBe("EAAG-segredo-123");
  });
  it("cada criptografia sai diferente (IV aleatório)", () => {
    expect(encryptToken("x")).not.toBe(encryptToken("x"));
  });
  it("token antigo em texto puro continua funcionando (migração suave)", () => {
    expect(isEncryptedToken("EAAGplain")).toBe(false);
    expect(decryptToken("EAAGplain")).toBe("EAAGplain");
  });
  it("adulterado falha", () => {
    const enc = encryptToken("abc");
    const broken = enc.slice(0, -4) + (enc.endsWith("AAAA") ? "BBBB" : "AAAA");
    expect(() => decryptToken(broken)).toThrow();
  });
});
