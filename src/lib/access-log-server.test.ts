import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  patientAccessLog: { findFirst: vi.fn(), create: vi.fn() },
  auditLog: { findFirst: vi.fn(), create: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { recordBulkAccess, recordPatientAccess } from "./access-log-server";

beforeEach(() => {
  for (const m of Object.values(db)) for (const fn of Object.values(m)) fn.mockReset();
  db.auditLog.findFirst.mockResolvedValue(null);
  db.patientAccessLog.findFirst.mockResolvedValue(null);
});

describe("recordBulkAccess (lista e busca de pacientes)", () => {
  it("grava quem viu, o quê e quantos — sem o termo buscado", async () => {
    await recordBulkAccess({ clinicId: "c1", userId: "u1", action: "LISTOU_PACIENTES", count: 240 });
    expect(db.auditLog.create).toHaveBeenCalledWith({
      data: { clinicId: "c1", userId: "u1", action: "LISTOU_PACIENTES", entity: "patient_bulk_access", entityId: "c1", changes: { count: 240 } },
    });
  });
  it("o mesmo usuário na mesma hora não grava de novo", async () => {
    db.auditLog.findFirst.mockResolvedValue({ id: "x" });
    await recordBulkAccess({ clinicId: "c1", userId: "u1", action: "BUSCOU_PACIENTES", count: 3 });
    expect(db.auditLog.create).not.toHaveBeenCalled();
    expect(db.auditLog.findFirst.mock.calls[0][0].where).toMatchObject({ clinicId: "c1", userId: "u1", action: "BUSCOU_PACIENTES", entity: "patient_bulk_access" });
  });
  it("lista vazia não grava", async () => {
    await recordBulkAccess({ clinicId: "c1", userId: "u1", action: "LISTOU_PACIENTES", count: 0 });
    expect(db.auditLog.create).not.toHaveBeenCalled();
  });
  it("nunca quebra a tela se o banco falhar", async () => {
    db.auditLog.create.mockRejectedValue(new Error("x"));
    await expect(recordBulkAccess({ clinicId: "c1", userId: "u1", action: "LISTOU_PACIENTES", count: 1 })).resolves.toBeUndefined();
  });
});

describe("recordPatientAccess", () => {
  it("edição pelo suporte grava sem consultar repetição", async () => {
    await recordPatientAccess({ clinicId: "c1", userId: "admin", conversationId: "conv", action: "SUPORTE_EDITOU_CADASTRO" });
    expect(db.patientAccessLog.findFirst).not.toHaveBeenCalled();
    expect(db.patientAccessLog.create).toHaveBeenCalledTimes(1);
  });
});
