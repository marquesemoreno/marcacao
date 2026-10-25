import { describe, it, expect } from "vitest";
import { isValidEmail, normalizeEmail, parseEmailCsv, smsCredits, toSmsNumber } from "./broadcast-channel";

describe("normalizeEmail / isValidEmail", () => {
  it("tira espaços e deixa minúsculo", () => {
    expect(normalizeEmail("  Maria@Exemplo.COM ")).toBe("maria@exemplo.com");
  });

  it("aceita endereços comuns", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("maria.souza+clinica@dominio.com.br")).toBe(true);
  });

  it("recusa endereço sem domínio, com espaço ou vazio", () => {
    for (const bad of ["", "a@b", "a b@c.com", "a@@b.com", "@b.com", "a@.com", "sem-arroba"]) {
      expect(isValidEmail(bad)).toBe(false);
    }
  });
});

describe("smsCredits", () => {
  it("até 160 caracteres = 1 crédito; acima, 1 a cada 153", () => {
    expect(smsCredits("")).toBe(0);
    expect(smsCredits("x".repeat(160))).toBe(1);
    expect(smsCredits("x".repeat(161))).toBe(2);
    expect(smsCredits("x".repeat(306))).toBe(2);
    expect(smsCredits("x".repeat(307))).toBe(3);
  });
});

describe("toSmsNumber", () => {
  it("devolve DDI 55 + DDD + celular, só dígitos", () => {
    expect(toSmsNumber("(77) 99999-1234")).toBe("5577999991234");
    expect(toSmsNumber("5577999991234")).toBe("5577999991234");
    expect(toSmsNumber("+55 77 99999-1234")).toBe("5577999991234");
  });

  it("celular antigo sem o 9 ganha o 9 (como no WhatsApp)", () => {
    expect(toSmsNumber("7788411342")).toBe("5577988411342");
  });

  it("telefone fixo não recebe SMS", () => {
    expect(toSmsNumber("7733221234")).toBeNull();
    expect(toSmsNumber("557733221234")).toBeNull();
  });

  it("número impossível vira null", () => {
    expect(toSmsNumber("")).toBeNull();
    expect(toSmsNumber("12345")).toBeNull();
    expect(toSmsNumber("abc")).toBeNull();
  });
});

describe("parseEmailCsv", () => {
  it("com cabeçalho: email vira o destinatário e as outras colunas viram variáveis", () => {
    const out = parseEmailCsv("email,nome,procedimento\nMaria@x.com,Maria,Consulta");
    expect(out).toEqual([{ email: "maria@x.com", variables: { nome: "Maria", procedimento: "Consulta" } }]);
  });

  it('aceita "e-mail" no cabeçalho e ponto e vírgula do Excel', () => {
    const out = parseEmailCsv("nome;e-mail\nJoão;joao@x.com");
    expect(out).toEqual([{ email: "joao@x.com", variables: { nome: "João" } }]);
  });

  it("sem cabeçalho: 1ª coluna é o e-mail, depois nome, procedimento, data", () => {
    const out = parseEmailCsv("ana@x.com,Ana,Retorno,10/11");
    expect(out).toEqual([{ email: "ana@x.com", variables: { nome: "Ana", procedimento: "Retorno", data: "10/11" } }]);
  });

  it("cabeçalho sem coluna de e-mail dá erro claro", () => {
    expect(() => parseEmailCsv("nome,telefone\nAna,77999991234")).toThrow(/e-mail/i);
  });

  it("CSV vazio devolve lista vazia", () => {
    expect(parseEmailCsv("  \n ")).toEqual([]);
  });
});
