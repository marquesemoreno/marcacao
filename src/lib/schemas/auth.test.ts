import { describe, it, expect } from "vitest";
import { loginSchema } from "./auth";

describe("loginSchema", () => {
  it("aceita e-mail e senha válidos", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "Senha123" });
    expect(result.success).toBe(true);
  });

  it("normaliza e-mail com espaços nas pontas (trim)", () => {
    const result = loginSchema.safeParse({ email: "  user@example.com  ", password: "Senha123" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("user@example.com");
    }
  });

  it("rejeita e-mail em formato inválido", () => {
    const result = loginSchema.safeParse({ email: "não-é-email", password: "Senha123" });
    expect(result.success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    const result = loginSchema.safeParse({ email: "user@example.com", password: "" });
    expect(result.success).toBe(false);
  });
});
