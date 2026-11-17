import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  resolveTvDisplay: vi.fn(),
  issueQueueTicket: vi.fn(),
  clinicFindUnique: vi.fn(),
  ip: "10.0.0.1",
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-forwarded-for": m.ip }) }));
vi.mock("@/lib/prisma", () => ({ prisma: { clinic: { findUnique: m.clinicFindUnique } } }));
vi.mock("@/lib/session", () => ({ requireClinicPermission: vi.fn(), requireClinicManager: vi.fn() }));
vi.mock("@/lib/tv-call-server", () => ({ resolveTvDisplay: m.resolveTvDisplay }));
vi.mock("@/lib/queue-ticket-server", () => ({
  issueQueueTicket: m.issueQueueTicket,
  callQueueTicket: vi.fn(),
  finishQueueTicket: vi.fn(),
  followQueueTicket: vi.fn(),
  listQueueServices: vi.fn(),
  queueToday: vi.fn(),
}));

import { takeTicket } from "./queue-ticket";

const ticket = { code: "N001", type: "N", followToken: "x", patient: null, appointmentTime: null, ahead: 0, createdAt: "", serviceName: null };

describe("takeTicket — QR do celular (auditoria M1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.clinicFindUnique.mockResolvedValue({ arrivalLat: null, arrivalLng: null, arrivalRadiusM: 150 });
    m.issueQueueTicket.mockResolvedValue(ticket);
  });

  it("QR não procura a agenda pelo CPF/telefone digitado", async () => {
    m.resolveTvDisplay.mockResolvedValue({ kind: "QR", clinicId: "c1" });
    m.ip = "10.0.0.2";
    const res = await takeTicket("qr-a", { type: "N", identifier: "71999998888", kind: "QR" });
    expect(res.ok).toBe(true);
    expect(m.issueQueueTicket).toHaveBeenCalledWith("c1", expect.objectContaining({ identifier: null }));
  });

  it("totem físico continua procurando pelo CPF/telefone", async () => {
    m.resolveTvDisplay.mockResolvedValue({ kind: "TOTEM", clinicId: "c1" });
    await takeTicket("totem-a", { type: "N", identifier: "71999998888", kind: "TOTEM" });
    expect(m.issueQueueTicket).toHaveBeenCalledWith("c1", expect.objectContaining({ identifier: "71999998888" }));
  });

  it("QR: 6ª senha em 10 min do mesmo celular é recusada", async () => {
    m.resolveTvDisplay.mockResolvedValue({ kind: "QR", clinicId: "c1" });
    m.ip = "10.0.0.3";
    for (let i = 0; i < 5; i++) expect((await takeTicket("qr-b", { type: "N", kind: "QR" })).ok).toBe(true);
    const sixth = await takeTicket("qr-b", { type: "N", kind: "QR" });
    expect(sixth.ok).toBe(false);
    expect(m.issueQueueTicket).toHaveBeenCalledTimes(5);
    m.ip = "10.0.0.4"; // outro celular não é afetado
    expect((await takeTicket("qr-b", { type: "N", kind: "QR" })).ok).toBe(true);
  });

  it("totem físico não tem limite por aparelho", async () => {
    m.resolveTvDisplay.mockResolvedValue({ kind: "TOTEM", clinicId: "c1" });
    m.ip = "10.0.0.5";
    for (let i = 0; i < 8; i++) expect((await takeTicket("totem-b", { type: "N", kind: "TOTEM" })).ok).toBe(true);
  });
});
