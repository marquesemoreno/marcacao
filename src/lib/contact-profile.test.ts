import { describe, expect, it } from "vitest";
import { profileOf, EMPTY_PROFILE } from "./contact-profile";

describe("profileOf", () => {
  const contact = {
    clinicProfiles: [
      { clinicId: "urolaser", cpf: "111", notes: "nota da Urolaser" },
      { clinicId: "santa", cpf: "222", notes: "nota da Santa Clara" },
    ],
  };
  it("devolve só o perfil da clínica pedida", () => {
    expect(profileOf(contact, "santa")).toMatchObject({ cpf: "222", notes: "nota da Santa Clara" });
    expect(profileOf(contact, "urolaser").notes).toBe("nota da Urolaser");
  });
  it("clínica sem perfil não vê o de outra", () => {
    expect(profileOf(contact, "outra")).toEqual(EMPTY_PROFILE);
    expect(profileOf({ clinicProfiles: [] }, "x")).toEqual(EMPTY_PROFILE);
  });
});
