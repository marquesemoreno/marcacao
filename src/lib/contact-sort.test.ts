import { describe, it, expect } from "vitest";
import { sortContactsNamedFirst } from "./contact-sort";

const c = (id: string, name: string, phone = "77999990000") => ({ id, name, phone });

describe("sortContactsNamedFirst", () => {
  it("contatos com nome de verdade vêm primeiro, em ordem alfabética (pt-BR, sem diferenciar acento/caixa)", () => {
    const out = sortContactsNamedFirst([c("1", "Zélia"), c("2", "ana"), c("3", "Álvaro"), c("4", "Bruna")]);
    expect(out.map((x) => x.id)).toEqual(["3", "2", "4", "1"]);
  });

  it("contatos só com telefone/ID/emoji como nome vão para o fim, em ordem de telefone", () => {
    const out = sortContactsNamedFirst([
      c("1", "(77) 99939-5571", "77999395571"),
      c("2", "Maria"),
      c("3", "😊", "77988880000"),
      c("4", "5577999990000", "77911112222"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["2", "4", "3", "1"]);
  });

  it("não altera a lista original", () => {
    const list = [c("1", "Zé"), c("2", "Ana")];
    sortContactsNamedFirst(list);
    expect(list.map((x) => x.id)).toEqual(["1", "2"]);
  });
});
