import { beforeEach, describe, expect, it, vi } from "vitest";

const findMany = vi.fn();
const requireClinicPermission = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { conversation: { findMany: (...a: unknown[]) => findMany(...a) } } }));
vi.mock("@/lib/session", () => ({ requireClinicPermission: (...a: unknown[]) => requireClinicPermission(...a) }));

import { getTagAudience, listTagAudienceOptions } from "./tag-audience";

beforeEach(() => {
  findMany.mockReset();
  requireClinicPermission.mockReset();
  requireClinicPermission.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
});

const row = (phone: string | null, name: string, tags: string[]) => ({ tags, contact: { phone, name } });

describe("listTagAudienceOptions", () => {
  it("exige a permissão de disparos e busca só conversas da clínica da sessão", async () => {
    findMany.mockResolvedValue([row("5577900000001", "Ana Lima", ["Natação"])]);
    const options = await listTagAudienceOptions();
    expect(requireClinicPermission).toHaveBeenCalledWith("disparos");
    expect(findMany.mock.calls[0][0].where.clinicId).toBe("clinic-a");
    expect(options).toEqual([{ tag: "Natação", count: 1 }]);
  });
});

describe("getTagAudience", () => {
  it("devolve os destinatários da tag, só da clínica da sessão", async () => {
    findMany.mockResolvedValue([row("5577900000001", "Ana Lima", ["Natação"]), row("5577900000002", "Bruno Reis", ["Palmilhas"])]);
    const recipients = await getTagAudience("Natação");
    expect(requireClinicPermission).toHaveBeenCalledWith("disparos");
    expect(findMany.mock.calls[0][0].where.clinicId).toBe("clinic-a");
    expect(recipients).toEqual([{ phone: "5577900000001", variables: { nome: "Ana", saudacao: "Oi, Ana" } }]);
  });

  it("recusa tag vazia ou longa demais sem consultar o banco", async () => {
    expect(await getTagAudience("  ")).toEqual([]);
    expect(await getTagAudience("x".repeat(200))).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
