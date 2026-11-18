import { describe, expect, it } from "vitest";
import { certificateCode, certificateLines, normalizeCertificateCode, sameCertificateCode, type CertificateFields } from "./lgpd-certificate";

const SECRET = "segredo-de-teste";
const fields: CertificateFields = {
  protocol: "cmabc123",
  clinicName: "Clínica Exemplo Ltda",
  clinicCnpj: "12345678000190",
  performedAt: "2026-11-18T15:30:00.000Z",
  performedBy: "Ana Suporte",
  performedFromIp: "200.1.2.3",
  messagesDeleted: 42,
  contactAnonymized: true,
};

describe("certificateCode", () => {
  it("é estável para os mesmos dados", () => {
    expect(certificateCode(fields, SECRET)).toBe(certificateCode({ ...fields }, SECRET));
  });

  it("tem 5 grupos de 4 letras/números", () => {
    expect(certificateCode(fields, SECRET)).toMatch(/^[0-9A-F]{4}(-[0-9A-F]{4}){4}$/);
  });

  it.each(Object.keys(fields) as (keyof CertificateFields)[])("muda se %s mudar", (key) => {
    const value = fields[key];
    const changed = typeof value === "number" ? value + 1 : typeof value === "boolean" ? !value : `${value ?? ""}x`;
    expect(certificateCode({ ...fields, [key]: changed }, SECRET)).not.toBe(certificateCode(fields, SECRET));
  });

  it("muda com outro segredo e recusa segredo vazio", () => {
    expect(certificateCode(fields, "outro")).not.toBe(certificateCode(fields, SECRET));
    expect(() => certificateCode(fields, "")).toThrow();
  });
});

describe("normalizeCertificateCode / sameCertificateCode", () => {
  it("aceita minúsculas, espaços e sem traços", () => {
    const code = certificateCode(fields, SECRET);
    expect(normalizeCertificateCode(` ${code.toLowerCase().replace(/-/g, " ")} `)).toBe(code);
  });
  it("texto que não é código vira null", () => {
    expect(normalizeCertificateCode("abc")).toBeNull();
    expect(normalizeCertificateCode("ZZZZ-ZZZZ-ZZZZ-ZZZZ-ZZZZ")).toBeNull();
  });
  it("compara códigos", () => {
    const code = certificateCode(fields, SECRET);
    expect(sameCertificateCode(code, code)).toBe(true);
    expect(sameCertificateCode(code, certificateCode({ ...fields, messagesDeleted: 1 }, SECRET))).toBe(false);
  });
});

describe("certificateLines", () => {
  const titular = { name: "Maria da Silva", phone: "5577999887766", maskedPhone: "55 77 *****-**66", cpf: "12345678901" };
  const text = certificateLines(fields, certificateCode(fields, SECRET)).join("\n");

  it("traz clínica, CNPJ formatado, data em Brasília, quem executou, IP, protocolo e código", () => {
    expect(text).toContain("Clínica Exemplo Ltda");
    expect(text).toContain("12.345.678/0001-90");
    expect(text).toContain("18/11/2026 12:30");
    expect(text).toContain("Ana Suporte");
    expect(text).toContain("200.1.2.3");
    expect(text).toContain("cmabc123");
    expect(text).toContain(certificateCode(fields, SECRET));
  });

  it("não tem nenhum dado do titular, nem mascarado", () => {
    for (const value of Object.values(titular)) expect(text).not.toContain(value);
    expect(text).not.toMatch(/\*{3}/);
  });

  it("sem IP registrado diz que não foi registrado", () => {
    expect(certificateLines({ ...fields, performedFromIp: null }, "X").join("\n")).toMatch(/não registrado/i);
  });
});
