import { describe, expect, it } from "vitest";
import { avatarInitials } from "./avatar-initials";

describe("avatarInitials", () => {
  it("duas primeiras palavras com letra", () => {
    expect(avatarInitials("Maria da Silva")).toBe("MD");
    expect(avatarInitials("joão")).toBe("J");
  });
  it("ignora pontuação e números: nome que é só telefone fica sem iniciais", () => {
    expect(avatarInitials("(77) 99939-5571")).toBe("");
    expect(avatarInitials("+55 77 9999")).toBe("");
    expect(avatarInitials("Dr. (Ana) Souza")).toBe("DA");
  });
});
