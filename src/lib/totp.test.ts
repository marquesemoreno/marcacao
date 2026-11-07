import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, generateTotpSecret, totpAt, totpUri, verifyTotp } from "./totp";

// RFC 6238, apêndice B (SHA-1, segredo ASCII "12345678901234567890"), 6 últimos dígitos.
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("bate com os vetores oficiais", () => {
    expect(totpAt(RFC_SECRET, 59_000)).toBe("287082");
    expect(totpAt(RFC_SECRET, 1_111_111_109_000)).toBe("081804");
    expect(totpAt(RFC_SECRET, 2_000_000_000_000)).toBe("279037");
  });

  it("base32 ida e volta", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it("aceita o código do passo anterior/seguinte (relógio do celular) e recusa o resto", () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now + 30_000), now)).toBe(true);
    expect(verifyTotp(RFC_SECRET, totpAt(RFC_SECRET, now - 90_000), now)).toBe(false);
    expect(verifyTotp(RFC_SECRET, " 287 082 ", 59_000)).toBe(true);
    expect(verifyTotp(RFC_SECRET, "abc", now)).toBe(false);
  });

  it("URI para o app autenticador", () => {
    expect(totpUri("JBSWY3DP", "ana@clinica.com")).toBe(
      "otpauth://totp/Conecta%20Sa%C3%BAde:ana%40clinica.com?secret=JBSWY3DP&issuer=Conecta%20Sa%C3%BAde&algorithm=SHA1&digits=6&period=30"
    );
  });
});
