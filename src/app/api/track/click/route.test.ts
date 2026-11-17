import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ adClick: { count: vi.fn(), upsert: vi.fn() } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { POST } from "./route";

const ORIGIN = "https://www.urolaservca.com.br";
let ipSeq = 0;
function click(ip = `10.1.0.${++ipSeq}`) {
  return new Request("https://x/api/track/click", {
    method: "POST",
    headers: { origin: ORIGIN, "x-forwarded-for": ip, "content-type": "text/plain" },
    body: JSON.stringify({ token: "abc123", params: { gclid: "Cj0KCQ-teste" } }),
  });
}

describe("/api/track/click (auditoria B1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    db.adClick.count.mockResolvedValue(0);
    db.adClick.upsert.mockResolvedValue({});
  });

  it("grava o clique de origem cadastrada", async () => {
    const res = await POST(click());
    expect(res.status).toBe(204);
    expect(db.adClick.upsert).toHaveBeenCalledTimes(1);
  });

  it("recusa origem fora da lista", async () => {
    const req = new Request("https://x/api/track/click", { method: "POST", headers: { origin: "https://evil.example" }, body: "{}" });
    expect((await POST(req)).status).toBe(403);
  });

  it("teto no banco: com 1000 cliques nos últimos 10 min, recusa sem gravar", async () => {
    db.adClick.count.mockResolvedValue(1000);
    const res = await POST(click());
    expect(res.status).toBe(429);
    expect(db.adClick.upsert).not.toHaveBeenCalled();
  });

  it("falha na contagem não derruba o rastreamento", async () => {
    db.adClick.count.mockRejectedValue(new Error("db fora"));
    expect((await POST(click())).status).toBe(204);
  });
});
