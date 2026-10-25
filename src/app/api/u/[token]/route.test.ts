import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { channelConsent: { findUnique: vi.fn(), update: vi.fn() } },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

import { GET, POST } from "./route";
import { signUnsubscribeToken } from "@/lib/unsubscribe-token";

const SECRET = "segredo-de-teste-longo-o-bastante";
const ctx = (token: string) => ({ params: Promise.resolve({ token }) });
const req = (method: string) => new Request("https://exemplo.com.br/api/u/x", { method });

beforeEach(() => {
  vi.clearAllMocks();
  process.env.UNSUBSCRIBE_SECRET = SECRET;
  prismaMock.channelConsent.findUnique.mockResolvedValue({ id: "consent1", channel: "EMAIL", clinic: { name: "Clínica <Teste>" } });
});

describe("/api/u/[token]", () => {
  it("GET com token válido só mostra a confirmação — não descadastra (scanners de e-mail abrem links)", async () => {
    const res = await GET(req("GET"), ctx(signUnsubscribeToken("consent1", SECRET)));
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('method="POST"');
    expect(html).toContain("Clínica &lt;Teste&gt;");
    expect(prismaMock.channelConsent.update).not.toHaveBeenCalled();
  });

  it("POST com token válido grava a saída", async () => {
    const res = await POST(req("POST"), ctx(signUnsubscribeToken("consent1", SECRET)));
    expect(res.status).toBe(200);
    expect(prismaMock.channelConsent.update).toHaveBeenCalledWith({
      where: { id: "consent1" },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("token adulterado: 404 e nada gravado", async () => {
    for (const handler of [GET, POST]) {
      const res = await handler(req("POST"), ctx("consent1.assinaturafalsa123"));
      expect(res.status).toBe(404);
    }
    expect(prismaMock.channelConsent.update).not.toHaveBeenCalled();
  });

  it("consentimento inexistente: 404 e nada gravado", async () => {
    prismaMock.channelConsent.findUnique.mockResolvedValue(null);
    const res = await POST(req("POST"), ctx(signUnsubscribeToken("consent1", SECRET)));
    expect(res.status).toBe(404);
    expect(prismaMock.channelConsent.update).not.toHaveBeenCalled();
  });

  it("sem segredo configurado, nenhum token vale", async () => {
    delete process.env.UNSUBSCRIBE_SECRET;
    const res = await POST(req("POST"), ctx(signUnsubscribeToken("consent1", SECRET)));
    expect(res.status).toBe(404);
    expect(prismaMock.channelConsent.update).not.toHaveBeenCalled();
  });
});
