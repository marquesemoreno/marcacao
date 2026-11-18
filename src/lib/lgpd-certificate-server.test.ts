import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  dataDeletionRecord: { findUnique: vi.fn(), update: vi.fn() },
  clinic: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { issueCertificate, verifyCertificateCode } from "./lgpd-certificate-server";
import { certificateCode } from "./lgpd-certificate";

const record = {
  id: "rec-1",
  clinicId: "clinic-a",
  createdAt: new Date("2026-11-18T15:30:00Z"),
  performedByUserId: "admin-1",
  performedFromIp: "200.1.2.3",
  messagesDeleted: 10,
  contactAnonymized: true,
  certificateCode: null as string | null,
  maskedPhone: "55 77 *****-**66",
};
const fields = {
  protocol: "rec-1",
  clinicName: "Clínica A Ltda",
  clinicCnpj: "12345678000190",
  performedAt: "2026-11-18T15:30:00.000Z",
  performedBy: "Ana Suporte",
  performedFromIp: "200.1.2.3",
  messagesDeleted: 10,
  contactAnonymized: true,
};

beforeEach(() => {
  process.env.LGPD_CERTIFICATE_SECRET = "s3";
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  db.dataDeletionRecord.findUnique.mockResolvedValue(record);
  db.clinic.findUnique.mockResolvedValue({ name: "Clínica A Ltda", cnpj: "12345678000190" });
  db.user.findUnique.mockResolvedValue({ name: "Ana Suporte" });
});

describe("issueCertificate", () => {
  it("grava o código calculado com os dados do registro", async () => {
    const code = await issueCertificate("rec-1");
    expect(code).toBe(certificateCode(fields, "s3"));
    expect(db.dataDeletionRecord.update).toHaveBeenCalledWith({ where: { id: "rec-1" }, data: { certificateCode: code } });
  });

  it("sem segredo configurado não emite (e não quebra a exclusão)", async () => {
    delete process.env.LGPD_CERTIFICATE_SECRET;
    const prev = process.env.NEXTAUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;
    expect(await issueCertificate("rec-1")).toBeNull();
    expect(db.dataDeletionRecord.update).not.toHaveBeenCalled();
    process.env.NEXTAUTH_SECRET = prev;
  });
});

describe("verifyCertificateCode", () => {
  it("código válido: devolve só clínica, data e protocolo", async () => {
    const code = certificateCode(fields, "s3");
    db.dataDeletionRecord.findUnique.mockResolvedValue({ ...record, certificateCode: code });
    const r = await verifyCertificateCode(code.toLowerCase());
    expect(db.dataDeletionRecord.findUnique).toHaveBeenCalledWith({ where: { certificateCode: code } });
    expect(r).toEqual({ valid: true, protocol: "rec-1", clinicName: "Clínica A Ltda", performedAt: "2026-11-18T15:30:00.000Z" });
    expect(JSON.stringify(r)).not.toContain("*");
  });

  it("registro alterado depois de emitido: inválido", async () => {
    const code = certificateCode(fields, "s3");
    db.dataDeletionRecord.findUnique.mockResolvedValue({ ...record, messagesDeleted: 99, certificateCode: code });
    expect(await verifyCertificateCode(code)).toEqual({ valid: false });
  });

  it("código que não existe ou mal digitado: inválido", async () => {
    db.dataDeletionRecord.findUnique.mockResolvedValue(null);
    expect(await verifyCertificateCode("AAAA-AAAA-AAAA-AAAA-AAAA")).toEqual({ valid: false });
    expect(await verifyCertificateCode("abc")).toEqual({ valid: false });
  });
});
