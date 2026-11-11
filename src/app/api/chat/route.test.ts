import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { clinicProcedure: { findMany: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { POST } from "./route";

const request = () =>
  new Request("https://exemplo.com.br/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "consulta urologia" }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.PUBLIC_CHAT_ENABLED;
  prismaMock.clinicProcedure.findMany.mockResolvedValue([]);
});

describe("POST /api/chat (assistente do site)", () => {
  it("desligado por padrão: responde 404 sem consultar o banco", async () => {
    const res = await POST(request());
    expect(res.status).toBe(404);
    expect(prismaMock.clinicProcedure.findMany).not.toHaveBeenCalled();
  });

  it("com PUBLIC_CHAT_ENABLED=1 volta a atender", async () => {
    process.env.PUBLIC_CHAT_ENABLED = "1";
    const res = await POST(request());
    expect(res.status).not.toBe(404);
    expect(prismaMock.clinicProcedure.findMany).toHaveBeenCalled();
  });
});
