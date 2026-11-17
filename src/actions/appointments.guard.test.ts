import { beforeEach, describe, expect, it, vi } from "vitest";

/** Auditoria de segurança 16/11/2026 (C1): o agendamento público não pode gravar no
 * sistema da clínica (ponte Firebird) nem em clínica fora do marketplace; quem agenda pelo
 * painel só agenda na própria clínica. */
const db = vi.hoisted(() => ({
  clinicProcedure: { findUnique: vi.fn() },
  appointment: { create: vi.fn(), count: vi.fn() },
  affiliate: { findUnique: vi.fn() },
}));
const session = vi.hoisted(() => ({ getClinicSessionOrNull: vi.fn(), requireAdminSession: vi.fn() }));
const bridge = vi.hoisted(() => ({ createBridgeAppointment: vi.fn() }));
const whatsapp = vi.hoisted(() => ({ sendAppointmentConfirmation: vi.fn() }));
const ip = vi.hoisted(() => ({ value: "203.0.113.1" }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => session);
vi.mock("@/lib/whatsapp", () => whatsapp);
vi.mock("@/lib/serialize", () => ({ toPlainAppointment: (a: unknown) => a }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => ({ get: (name: string) => (name === "x-forwarded-for" ? ip.value : null) }),
}));
vi.mock("@/lib/hospital-bridge", () => ({
  isBridgeId: (id: string) => id.startsWith("bridge:"),
  getBridgeClinicId: (id: string) => id.slice("bridge:".length).split(":")[0],
  createBridgeAppointment: bridge.createBridgeAppointment,
}));

import { createAppointment, createClinicAppointment } from "./appointments";

const base = { patientName: "Maria Souza", patientPhone: "77999990000", date: "2026-12-01" };
const listed = { id: "cp1", clinicId: "clinic-a", clinic: { active: true, listedInMarketplace: true } };
let ipSeq = 0;

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  for (const fn of [...Object.values(session), ...Object.values(bridge), ...Object.values(whatsapp)]) fn.mockReset();
  db.appointment.count.mockResolvedValue(0);
  db.appointment.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "a1", ...data }));
  db.clinicProcedure.findUnique.mockResolvedValue(listed);
  session.getClinicSessionOrNull.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
  bridge.createBridgeAppointment.mockResolvedValue({ id: "bridge-appt" });
  ip.value = `203.0.113.${++ipSeq}`; // cada teste é um visitante novo
});

describe("createAppointment (público, sem login)", () => {
  it("recusa id da ponte: nunca grava no sistema da clínica", async () => {
    await expect(createAppointment({ ...base, clinicProcedureId: "bridge:clinic-a:12" })).rejects.toThrow();
    expect(bridge.createBridgeAppointment).not.toHaveBeenCalled();
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it("recusa clínica fora do marketplace ou inativa", async () => {
    db.clinicProcedure.findUnique.mockResolvedValue({ ...listed, clinic: { active: true, listedInMarketplace: false } });
    await expect(createAppointment({ ...base, clinicProcedureId: "cp1" })).rejects.toThrow();
    db.clinicProcedure.findUnique.mockResolvedValue({ ...listed, clinic: { active: false, listedInMarketplace: true } });
    await expect(createAppointment({ ...base, clinicProcedureId: "cp1" })).rejects.toThrow();
    db.clinicProcedure.findUnique.mockResolvedValue(null);
    await expect(createAppointment({ ...base, clinicProcedureId: "nao-existe" })).rejects.toThrow();
    expect(db.appointment.create).not.toHaveBeenCalled();
    expect(whatsapp.sendAppointmentConfirmation).not.toHaveBeenCalled();
  });

  it("cria no catálogo de clínica listada e envia a confirmação", async () => {
    const a = await createAppointment({ ...base, clinicProcedureId: "cp1", notes: "manhã" });
    expect(a.id).toBe("a1");
    expect(db.appointment.create.mock.calls[0][0].data).toMatchObject({ clinicProcedureId: "cp1", patientPhone: "77999990000", notes: "manhã" });
    expect(whatsapp.sendAppointmentConfirmation).toHaveBeenCalledTimes(1);
  });

  it("recusa nome ou observação longos demais (texto vai na mensagem de WhatsApp)", async () => {
    await expect(createAppointment({ ...base, patientName: `Maria ${"x".repeat(200)}`, clinicProcedureId: "cp1" })).rejects.toThrow();
    await expect(createAppointment({ ...base, clinicProcedureId: "cp1", notes: "x".repeat(1200) })).rejects.toThrow();
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it("limita pedidos seguidos para o mesmo telefone", async () => {
    db.appointment.count.mockResolvedValue(3);
    await expect(createAppointment({ ...base, clinicProcedureId: "cp1" })).rejects.toThrow(/muitos/i);
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it("limita pedidos seguidos do mesmo visitante", async () => {
    for (let i = 0; i < 5; i++) await createAppointment({ ...base, patientPhone: `7799999000${i}`, clinicProcedureId: "cp1" });
    await expect(createAppointment({ ...base, patientPhone: "77999990009", clinicProcedureId: "cp1" })).rejects.toThrow(/muitos/i);
    expect(db.appointment.create).toHaveBeenCalledTimes(5);
  });
});

describe("createClinicAppointment (painel)", () => {
  it("sem sessão de clínica nem de admin, recusa", async () => {
    session.getClinicSessionOrNull.mockResolvedValue(null);
    session.requireAdminSession.mockRejectedValue(new Error("Não autorizado"));
    await expect(createClinicAppointment({ ...base, clinicProcedureId: "bridge:clinic-a:12" })).rejects.toThrow("Não autorizado");
    expect(bridge.createBridgeAppointment).not.toHaveBeenCalled();
  });

  it("grava na ponte da clínica da sessão", async () => {
    const a = await createClinicAppointment({ ...base, clinicProcedureId: "bridge:clinic-a:12", medicoId: "7" });
    expect(a.id).toBe("bridge-appt");
    expect(bridge.createBridgeAppointment).toHaveBeenCalledWith("clinic-a", expect.objectContaining({ clinicProcedureId: "bridge:clinic-a:12", medicoId: "7" }));
  });

  it("recusa id da ponte de outra clínica", async () => {
    await expect(createClinicAppointment({ ...base, clinicProcedureId: "bridge:clinic-b:12" })).rejects.toThrow();
    expect(bridge.createBridgeAppointment).not.toHaveBeenCalled();
  });

  it("recusa procedimento do catálogo de outra clínica", async () => {
    db.clinicProcedure.findUnique.mockResolvedValue({ ...listed, clinicId: "clinic-b" });
    await expect(createClinicAppointment({ ...base, clinicProcedureId: "cp1" })).rejects.toThrow();
    expect(db.appointment.create).not.toHaveBeenCalled();
  });

  it("clínica fora do marketplace agenda no próprio catálogo", async () => {
    db.clinicProcedure.findUnique.mockResolvedValue({ ...listed, clinic: { active: true, listedInMarketplace: false } });
    const a = await createClinicAppointment({ ...base, clinicProcedureId: "cp1" });
    expect(a.id).toBe("a1");
  });

  it("admin agenda na clínica dona do procedimento", async () => {
    session.getClinicSessionOrNull.mockResolvedValue(null);
    session.requireAdminSession.mockResolvedValue({ userId: "admin" });
    await createClinicAppointment({ ...base, clinicProcedureId: "bridge:clinic-b:3" });
    expect(bridge.createBridgeAppointment).toHaveBeenCalledWith("clinic-b", expect.anything());
  });
});
