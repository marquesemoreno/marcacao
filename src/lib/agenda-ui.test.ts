import { describe, expect, it } from "vitest";
import { toTitleCase } from "./agenda-ui";

describe("toTitleCase", () => {
  it("preposições de nome ficam minúsculas", () => {
    expect(toTitleCase("MARIA DA SILVA DOS SANTOS")).toBe("Maria da Silva dos Santos");
    expect(toTitleCase("joão de souza e lima")).toBe("João de Souza e Lima");
  });
  it("primeira palavra sempre maiúscula", () => {
    expect(toTitleCase("de souza")).toBe("De Souza");
  });
});
