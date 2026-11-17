import { beforeEach, describe, expect, it, vi } from "vitest";

/** Auditoria 16/11/2026 (M4): telefone cadastrado como marcador recebe campanha sem aceite
 * de marketing — então só a gestão cadastra marcador ou troca o telefone de um. */
const db = vi.hoisted(() => ({
  marcador: { findMany: vi.fn(), createMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}));
const session = vi.hoisted(() => ({ requireClinicSession: vi.fn(), isClinicManager: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => session);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { importMarcadores, updateMarcador } from "./marcadores";

beforeEach(() => {
  for (const fn of Object.values(db.marcador)) fn.mockReset();
  session.requireClinicSession.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
  session.isClinicManager.mockResolvedValue(false);
  db.marcador.findMany.mockResolvedValue([]);
  db.marcador.findFirst.mockResolvedValue({ id: "m1", clinicId: "clinic-a", name: "Lene", phone: "5577988314115" });
});

describe("importMarcadores", () => {
  it("recepção não cadastra marcador", async () => {
    const r = await importMarcadores("Lene – 77 98831-4115");
    expect(r).toMatchObject({ created: 0, error: expect.stringMatching(/gestão/i) });
    expect(db.marcador.createMany).not.toHaveBeenCalled();
  });
  it("gestão cadastra", async () => {
    session.isClinicManager.mockResolvedValue(true);
    const r = await importMarcadores("Lene – 77 98831-4115");
    expect(r).toMatchObject({ created: 1, skipped: 0 });
    expect(r.error).toBeUndefined();
    expect(db.marcador.createMany.mock.calls[0][0].data[0]).toMatchObject({ clinicId: "clinic-a", name: "Lene" });
  });
});

describe("updateMarcador", () => {
  it("recepção ativa/desativa e renomeia", async () => {
    expect(await updateMarcador("m1", { active: false })).toEqual({ success: true });
    expect(db.marcador.update).toHaveBeenCalledTimes(1);
  });
  it("recepção não troca o telefone", async () => {
    const r = await updateMarcador("m1", { phone: "77 99999-0000" });
    expect(r).toMatchObject({ success: false, error: expect.stringMatching(/gestão/i) });
    expect(db.marcador.update).not.toHaveBeenCalled();
  });
  it("gestão troca o telefone", async () => {
    session.isClinicManager.mockResolvedValue(true);
    expect(await updateMarcador("m1", { phone: "77 99999-0000" })).toEqual({ success: true });
    expect(db.marcador.update.mock.calls[0][0].data).toMatchObject({ phone: "5577999990000" });
  });
});
