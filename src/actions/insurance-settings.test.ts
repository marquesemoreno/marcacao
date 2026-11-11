import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  clinicInsuranceSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn() },
}));
const session = vi.hoisted(() => ({ requireClinicSession: vi.fn(), requireClinicManager: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => session);

import { getInsuranceSettings, setInsuranceSettings } from "./insurance-settings";

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  for (const fn of Object.values(session)) fn.mockReset();
  session.requireClinicSession.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
  session.requireClinicManager.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
  db.user.findUnique.mockResolvedValue({ isManager: true });
  db.clinicInsuranceSettings.findUnique.mockResolvedValue(null);
});

describe("getInsuranceSettings", () => {
  it("clínica sem cadastro vem desligada e vazia", async () => {
    expect(await getInsuranceSettings()).toEqual({ enabled: false, accepted: [], note: "", canEdit: true });
    expect(db.clinicInsuranceSettings.findUnique).toHaveBeenCalledWith({ where: { clinicId: "clinic-a" } });
  });

  it("recepção vê, mas não edita", async () => {
    db.user.findUnique.mockResolvedValue({ isManager: false });
    expect((await getInsuranceSettings()).canEdit).toBe(false);
  });
});

describe("setInsuranceSettings", () => {
  it("só a gestão salva, e sempre na clínica da sessão", async () => {
    await setInsuranceSettings({ enabled: true, acceptedText: "Unimed\nCassi, unimed", note: " Também atendemos particular. " });
    expect(session.requireClinicManager).toHaveBeenCalled();
    const call = db.clinicInsuranceSettings.upsert.mock.calls[0][0];
    expect(call.where).toEqual({ clinicId: "clinic-a" });
    expect(call.update).toEqual({ enabled: true, accepted: ["Unimed", "Cassi"], note: "Também atendemos particular." });
    expect(call.create).toEqual({ clinicId: "clinic-a", enabled: true, accepted: ["Unimed", "Cassi"], note: "Também atendemos particular." });
  });

  it("não liga sem nenhum convênio cadastrado", async () => {
    await expect(setInsuranceSettings({ enabled: true, acceptedText: " \n ", note: "" })).rejects.toThrow(/convênio/);
    expect(db.clinicInsuranceSettings.upsert).not.toHaveBeenCalled();
  });

  it("desligada pode salvar lista vazia", async () => {
    await setInsuranceSettings({ enabled: false, acceptedText: "", note: "" });
    expect(db.clinicInsuranceSettings.upsert.mock.calls[0][0].update).toEqual({ enabled: false, accepted: [], note: null });
  });

  it("quem não é gestão é barrado antes de gravar", async () => {
    session.requireClinicManager.mockRejectedValue(new Error("Acesso restrito à gestão da clínica"));
    await expect(setInsuranceSettings({ enabled: false, acceptedText: "Unimed", note: "" })).rejects.toThrow(/gestão/);
    expect(db.clinicInsuranceSettings.upsert).not.toHaveBeenCalled();
  });
});
