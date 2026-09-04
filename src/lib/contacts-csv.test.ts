import { describe, it, expect } from "vitest";
import { parseContactsCsv } from "./contacts-csv";

describe("parseContactsCsv", () => {
  it("reconhece cabeçalho nome/telefone/cpf em qualquer ordem", () => {
    const csv = "telefone;nome;cpf\n77999998888;Maria Silva;12345678900";
    expect(parseContactsCsv(csv)).toEqual([{ name: "Maria Silva", phone: "77999998888", cpf: "12345678900" }]);
  });

  it("sem cabeçalho, assume a ordem nome,telefone,cpf", () => {
    const csv = "Maria Silva,77999998888,12345678900\nJoão Souza,77988887777";
    expect(parseContactsCsv(csv)).toEqual([
      { name: "Maria Silva", phone: "77999998888", cpf: "12345678900" },
      { name: "João Souza", phone: "77988887777", cpf: undefined },
    ]);
  });

  it("detecta ponto-e-vírgula (exportação de Excel/Sheets em pt-BR)", () => {
    const csv = "nome;telefone\nMaria Silva;77999998888";
    expect(parseContactsCsv(csv)).toEqual([{ name: "Maria Silva", phone: "77999998888", cpf: undefined }]);
  });

  it("ignora linhas em branco e linhas sem nome ou telefone", () => {
    const csv = "nome,telefone\nMaria Silva,77999998888\n\n,77988887777\nJoão Souza,";
    expect(parseContactsCsv(csv)).toEqual([{ name: "Maria Silva", phone: "77999998888", cpf: undefined }]);
  });

  it("reclama se não achar coluna de nome", () => {
    expect(() => parseContactsCsv("telefone\n77999998888")).toThrow(/nome/i);
  });

  it("reclama se não achar coluna de telefone", () => {
    expect(() => parseContactsCsv("nome\nMaria Silva")).toThrow(/telefone/i);
  });

  it("string vazia devolve lista vazia", () => {
    expect(parseContactsCsv("")).toEqual([]);
  });
});
