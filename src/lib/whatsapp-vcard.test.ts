import { describe, expect, it } from "vitest";
import { formatContactCardMessage, parseVcard } from "./whatsapp-vcard";

const vcard = (name: string, tel: string) =>
  `BEGIN:VCARD\nVERSION:3.0\nN:;${name};;;\nFN:${name}\n${tel}\nEND:VCARD`;

describe("parseVcard", () => {
  it("prefere o waid da linha TEL", () => {
    expect(parseVcard(vcard("Maria", "item1.TEL;waid=5577991234567:+55 77 99123-4567"))).toEqual({
      name: "Maria",
      phone: "5577991234567",
    });
  });

  it("cai pra linha TEL sem waid", () => {
    expect(parseVcard(vcard("João", "TEL;type=CELL:+55 (77) 9 9876-5432"))?.phone).toBe("5577998765432");
  });

  it("sem telefone retorna phone null", () => {
    expect(parseVcard("BEGIN:VCARD\nFN:Sem Tel\nEND:VCARD")).toEqual({ name: "Sem Tel", phone: null });
  });

  it("aceita CRLF", () => {
    expect(parseVcard(vcard("Ana", "TEL;waid=557788887777:+55 77 8888-7777").replace(/\n/g, "\r\n"))).toEqual({
      name: "Ana",
      phone: "557788887777",
    });
  });
});

describe("formatContactCardMessage", () => {
  it("contactMessage vira uma linha legível", () => {
    const msg = { contactMessage: { displayName: "Maria", vcard: vcard("Maria", "TEL;waid=5577991234567:x") } };
    expect(formatContactCardMessage(msg)).toBe("📇 Contato: Maria — +55 77 99123-4567");
  });

  it("contactsArrayMessage vira uma linha por contato", () => {
    const msg = {
      contactsArrayMessage: {
        displayName: "2 contatos",
        contacts: [
          { displayName: "Maria", vcard: vcard("Maria", "TEL;waid=5577991234567:x") },
          { displayName: "Fixo", vcard: vcard("Fixo", "TEL:+55 77 3422-1100") },
        ],
      },
    };
    expect(formatContactCardMessage(msg)).toBe(
      "📇 Contato: Maria — +55 77 99123-4567\n📇 Contato: Fixo — +55 77 3422-1100"
    );
  });

  it("usa FN quando não há displayName e omite telefone ausente", () => {
    expect(formatContactCardMessage({ contactMessage: { vcard: "BEGIN:VCARD\nFN:Zé\nEND:VCARD" } })).toBe("📇 Contato: Zé");
  });

  it("outros tipos retornam null", () => {
    expect(formatContactCardMessage({ conversation: "oi" })).toBeNull();
    expect(formatContactCardMessage(undefined)).toBeNull();
  });
});
