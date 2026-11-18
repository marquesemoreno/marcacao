import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  channelConsent: { findMany: vi.fn() },
  consentAcceptance: { findMany: vi.fn() },
  appointment: { findMany: vi.fn() },
  message: { findMany: vi.fn() },
}));
const mocks = vi.hoisted(() => ({ requireClinicPermission: vi.fn(), recordPatientAccess: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => ({ requireClinicPermission: mocks.requireClinicPermission }));
vi.mock("@/lib/access-log-server", () => ({ recordPatientAccess: mocks.recordPatientAccess }));

import { exportPatientData } from "./patient-export";

const conversation = {
  id: "conv-1",
  contactId: "contact-1",
  contact: { name: "Maria", phone: "5577999887766", instagramUsername: null, clinicProfiles: [] },
  clinic: { name: "Clínica A Ltda", cnpj: "12345678000190" },
};

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.requireClinicPermission.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
  db.conversation.findFirst.mockResolvedValue(conversation);
  db.channelConsent.findMany.mockResolvedValue([]);
  db.consentAcceptance.findMany.mockResolvedValue([]);
  db.appointment.findMany.mockResolvedValue([]);
  db.message.findMany.mockResolvedValue([
    { createdAt: new Date("2026-11-01T12:00:00Z"), direction: "INBOUND", type: "TEXT", content: "Oi" },
    { createdAt: new Date("2026-11-01T12:01:00Z"), direction: "OUTBOUND", type: "INTERNAL_NOTE", content: "nota" },
  ]);
});

describe("exportPatientData", () => {
  it("só a gestão exporta (permissão de configuração)", async () => {
    await exportPatientData("conv-1");
    expect(mocks.requireClinicPermission).toHaveBeenCalledWith("config");
  });

  it("recusa conversa de outra clínica", async () => {
    db.conversation.findFirst.mockResolvedValue(null);
    const r = await exportPatientData("de-outra");
    expect(db.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "de-outra", clinicId: "clinic-a" });
    expect(r.success).toBe(false);
    expect(mocks.recordPatientAccess).not.toHaveBeenCalled();
  });

  it("busca tudo dentro da clínica, sem nota interna, e registra em Acessos", async () => {
    const r = await exportPatientData("conv-1");
    expect(db.message.findMany.mock.calls[0][0].where).toEqual({ conversationId: "conv-1", type: { not: "INTERNAL_NOTE" } });
    expect(db.channelConsent.findMany.mock.calls[0][0].where.clinicId).toBe("clinic-a");
    expect(db.consentAcceptance.findMany.mock.calls[0][0].where.clinicId).toBe("clinic-a");
    expect(db.appointment.findMany.mock.calls[0][0].where.clinicProcedure).toEqual({ clinicId: "clinic-a" });
    expect(mocks.recordPatientAccess).toHaveBeenCalledWith({ clinicId: "clinic-a", userId: "u1", conversationId: "conv-1", action: "EXPORTOU_DADOS" });
    if (!r.success) throw new Error(r.error);
    expect(r.fileName).toMatch(/^dados-do-titular-\d{4}-\d{2}-\d{2}\.json$/);
    expect(r.json).not.toContain("nota");
    expect(JSON.parse(r.json).titular.nome).toBe("Maria");
  });
});
