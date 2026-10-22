import { describe, expect, it } from "vitest";
import { normalizeTestRecipient } from "./test-recipient";

describe("normalizeTestRecipient", () => {
  it("número brasileiro sem o 55 ganha o código do país", () => {
    expect(normalizeTestRecipient("77 99931-1841")).toBe("5577999311841");
    expect(normalizeTestRecipient("(77) 3422-1010")).toBe("557734221010");
  });
  it("com código do país fica como está (Brasil e EUA)", () => {
    expect(normalizeTestRecipient("+55 77 99931-1841")).toBe("5577999311841");
    expect(normalizeTestRecipient("+1 555 163 3414")).toBe("15551633414");
  });
  it("curto ou longo demais é inválido", () => {
    expect(normalizeTestRecipient("12345")).toBeNull();
    expect(normalizeTestRecipient("1234567890123456")).toBeNull();
  });
});
