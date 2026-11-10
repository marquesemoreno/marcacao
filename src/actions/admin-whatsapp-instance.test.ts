import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdminSession, getEvolutionConfig, setEvolutionWebhook } = vi.hoisted(() => ({
  requireAdminSession: vi.fn(),
  getEvolutionConfig: vi.fn(),
  setEvolutionWebhook: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/session", () => ({ requireAdminSession }));
vi.mock("@/lib/whatsapp", () => ({ getEvolutionConfig }));
vi.mock("@/lib/evolution-admin", () => ({ setEvolutionWebhook }));

import { reapplyGlobalWebhook } from "./admin-whatsapp-instance";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  requireAdminSession.mockResolvedValue({ user: { id: "admin1" } });
  getEvolutionConfig.mockResolvedValue({ apiUrl: "https://evolution.exemplo", apiKey: "k", instanceName: "GLOBAL" });
  setEvolutionWebhook.mockResolvedValue({ success: true, data: {} });
});

describe("reapplyGlobalWebhook", () => {
  it("reaplica o webhook da instância global (sem clínica) e diz se foi com token", async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "s3gredo";
    const result = await reapplyGlobalWebhook();
    expect(getEvolutionConfig).toHaveBeenCalledWith();
    expect(setEvolutionWebhook).toHaveBeenCalledWith({
      apiUrl: "https://evolution.exemplo",
      apiKey: "k",
      instanceName: "GLOBAL",
    });
    expect(result).toEqual({ success: true, withToken: true, instanceName: "GLOBAL" });
  });

  it("sem API Key da instância global, não chama a Evolution", async () => {
    getEvolutionConfig.mockResolvedValue({ apiUrl: "https://evolution.exemplo", apiKey: undefined, instanceName: "GLOBAL" });
    const result = await reapplyGlobalWebhook();
    expect(result.success).toBe(false);
    expect(setEvolutionWebhook).not.toHaveBeenCalled();
  });

  it("exige sessão de admin", async () => {
    requireAdminSession.mockRejectedValue(new Error("Não autorizado"));
    await expect(reapplyGlobalWebhook()).rejects.toThrow("Não autorizado");
    expect(setEvolutionWebhook).not.toHaveBeenCalled();
  });

  it("devolve o erro da Evolution", async () => {
    setEvolutionWebhook.mockResolvedValue({ success: false, error: "HTTP 404" });
    expect(await reapplyGlobalWebhook()).toEqual({ success: false, error: "HTTP 404" });
  });
});
