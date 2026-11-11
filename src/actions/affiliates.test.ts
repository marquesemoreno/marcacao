import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock, cookieStore } = vi.hoisted(() => ({
  prismaMock: {
    affiliate: { findFirst: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    appointment: { findMany: vi.fn() },
  },
  cookieStore: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/session", () => ({ requireAdminSession: vi.fn() }));

import { getAffiliateDashboard, getAffiliateSession, loginAffiliateAction } from "./affiliates";

const affiliate = { id: "aff1", name: "Ana Lima", code: "MARC-1234", phone: "77988887777", totalEarned: 0, totalPaid: 0, payments: [] };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.AFFILIATE_PANEL_ENABLED;
  cookieStore.get.mockReturnValue({ value: "aff1" });
  prismaMock.affiliate.findFirst.mockResolvedValue(affiliate);
  prismaMock.affiliate.findUnique.mockResolvedValue(affiliate);
  prismaMock.affiliate.findUniqueOrThrow.mockResolvedValue(affiliate);
  prismaMock.appointment.findMany.mockResolvedValue([]);
});

describe("painel do marcador desligado (padrão)", () => {
  it("login é recusado sem consultar o banco nem gravar cookie", async () => {
    await expect(loginAffiliateAction({ phone: "77988887777", code: "MARC-1234" })).rejects.toThrow(/indisponível/);
    expect(prismaMock.affiliate.findFirst).not.toHaveBeenCalled();
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("cookie antigo não vale como sessão", async () => {
    expect(await getAffiliateSession()).toBeNull();
    expect(prismaMock.affiliate.findUnique).not.toHaveBeenCalled();
  });

  it("o painel não devolve dados, nem com id válido", async () => {
    await expect(getAffiliateDashboard("aff1")).rejects.toThrow("Não autorizado");
    expect(prismaMock.affiliate.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});

describe("painel do marcador ligado", () => {
  beforeEach(() => {
    process.env.AFFILIATE_PANEL_ENABLED = "1";
  });

  it("o painel só devolve os dados do marcador da própria sessão", async () => {
    await expect(getAffiliateDashboard("aff2")).rejects.toThrow("Não autorizado");
    expect(prismaMock.affiliate.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("sem cookie, o painel não devolve dados", async () => {
    cookieStore.get.mockReturnValue(undefined);
    await expect(getAffiliateDashboard("aff1")).rejects.toThrow("Não autorizado");
  });

  it("com a sessão do próprio marcador, devolve o painel", async () => {
    const result = await getAffiliateDashboard("aff1");
    expect(result.affiliate.code).toBe("MARC-1234");
  });
});
