import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  hospitalIntegration: { findMany: vi.fn() },
  patientCall: { findFirst: vi.fn() },
}));
const createPatientCall = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/tv-call-server", () => ({ createPatientCall }));
vi.mock("@/lib/token-crypto", () => ({ decryptToken: (s: string) => s.replace(/^enc:/, "") }));

import { POST } from "./route";

function call(body: unknown, token = "segredo-urolaser") {
  return new Request("https://x/api/bridge/tv-call", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-token": token },
    body: JSON.stringify(body),
  });
}

const valid = { numero: 36719, paciente: "AELCO ALCANTARA BATISTA", medico: "ALAN PASCOAL SILVA SANTOS", sala: "Consultório 1" };

describe("/api/bridge/tv-call (chamada vinda do sistema da clínica)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.hospitalIntegration.findMany.mockResolvedValue([
      { clinicId: "c-santa", apiToken: "enc:segredo-santa" },
      { clinicId: "c-uro", apiToken: "enc:segredo-urolaser" },
    ]);
    db.patientCall.findFirst.mockResolvedValue(null);
    createPatientCall.mockResolvedValue({ id: "call1" });
  });

  it("acha a clínica pelo token da ponte e anuncia na TV", async () => {
    const res = await POST(call(valid));
    expect(res.status).toBe(200);
    expect(createPatientCall).toHaveBeenCalledWith("c-uro", null, {
      source: "BRIDGE",
      externalId: "36719",
      patientName: "AELCO ALCANTARA BATISTA",
      doctor: "ALAN PASCOAL SILVA SANTOS",
      room: "Consultório 1",
    });
  });

  it("token desconhecido → 401, sem chamar", async () => {
    const res = await POST(call(valid, "outro"));
    expect(res.status).toBe(401);
    expect(createPatientCall).not.toHaveBeenCalled();
  });

  it("sem nome do paciente → 400", async () => {
    const res = await POST(call({ numero: 1, paciente: "  " }));
    expect(res.status).toBe(400);
  });

  it("mesma marcação chamada há menos de 90 s (reenvio da ponte) → não repete", async () => {
    db.patientCall.findFirst.mockResolvedValue({ id: "antes" });
    const res = await POST(call(valid));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ duplicate: true });
    expect(createPatientCall).not.toHaveBeenCalled();
  });

  it("sala vazia vira null (vale a sala fixa do médico)", async () => {
    await POST(call({ ...valid, sala: "" }));
    expect(createPatientCall.mock.calls[0][2].room).toBeNull();
  });
});
