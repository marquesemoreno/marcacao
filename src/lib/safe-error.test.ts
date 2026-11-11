import { describe, expect, it } from "vitest";
import { errorSummary } from "./safe-error";

describe("errorSummary", () => {
  it("fica só com a primeira linha: erro do Prisma traz os argumentos da consulta nas seguintes", () => {
    const prismaLike = new Error(
      "Invalid `prisma.contact.create()` invocation:\n\n{\n  data: {\n    name: \"Maria Souza\",\n    phone: \"5577988887777\"\n  }\n}\n\nUnique constraint failed"
    );
    const summary = errorSummary(prismaLike);
    expect(summary).toBe("Invalid `prisma.contact.create()` invocation:");
    expect(summary).not.toContain("Maria");
    expect(summary).not.toContain("5577988887777");
  });

  it("põe o código do erro na frente quando existe (P2002, ECONNRESET…)", () => {
    const error = Object.assign(new Error("Unique constraint failed\nmais detalhes"), { code: "P2002" });
    expect(errorSummary(error)).toBe("P2002 Unique constraint failed");
  });

  it("corta mensagens longas", () => {
    expect(errorSummary(new Error("x".repeat(1000))).length).toBe(300);
  });

  it("mascara sequências longas de dígitos (telefone, CPF) que apareçam na primeira linha", () => {
    expect(errorSummary(new Error("Número 5577988887777 inválido, CPF 123.456.789-09"))).toBe(
      "Número [número] inválido, CPF [número]"
    );
    expect(errorSummary(new Error("HTTP 404 em 3 tentativas"))).toBe("HTTP 404 em 3 tentativas");
  });

  it("aceita o que não é Error", () => {
    expect(errorSummary("falhou\nlinha 2")).toBe("falhou");
    expect(errorSummary(undefined)).toBe("erro desconhecido");
    expect(errorSummary({ message: "objeto\ncom detalhe", code: "E1" })).toBe("E1 objeto");
  });
});
