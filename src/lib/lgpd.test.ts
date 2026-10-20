import { describe, expect, it } from "vitest";
import { maskPhone, ANONYMIZED_NAME } from "./lgpd";

describe("maskPhone", () => {
  it("mantém só DDD e os 2 últimos dígitos", () => {
    expect(maskPhone("5577999311841")).toBe("55 77 *****-**41");
    expect(maskPhone(null)).toBeNull();
  });
  it("nome do contato anonimizado", () => {
    expect(ANONYMIZED_NAME).toBe("Paciente (dados excluídos)");
  });
});
