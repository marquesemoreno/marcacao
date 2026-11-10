import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    whatsappInstance: { findUnique: vi.fn() },
    webhookLog: { create: vi.fn() },
    message: { findUnique: vi.fn(), create: vi.fn() },
    contact: { upsert: vi.fn() },
  },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase-server", () => ({ notifyInboxRealtime: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";

/** Mensagem de texto recebida pela instância exclusiva da clínica, no formato da Evolution. */
const upsertBody = {
  event: "messages.upsert",
  instance: "clinica-teste",
  data: {
    key: { remoteJid: "5577988887777@s.whatsapp.net", fromMe: false, id: "KEY1" },
    pushName: "Maria",
    message: { conversation: "Oi, quero marcar" },
  },
};

const evolutionRequest = (body: unknown) =>
  new Request("https://exemplo.com.br/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  prismaMock.whatsappInstance.findUnique.mockResolvedValue({
    clinicId: "clinic1",
    apiUrl: "https://evolution.exemplo",
    apiKey: "k",
    instanceName: "clinica-teste",
  });
  prismaMock.webhookLog.create.mockResolvedValue({});
  prismaMock.message.findUnique.mockResolvedValue(null);
});

describe("POST /api/webhooks/whatsapp (Evolution)", () => {
  it("reenvio de mensagem já gravada responde 200 sem gravar nem rodar a automação de novo", async () => {
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg1" });
    const res = await POST(evolutionRequest(upsertBody));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, status: "duplicate" });
    expect(prismaMock.contact.upsert).not.toHaveBeenCalled();
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("erro inesperado responde 500 (quem mandou reenvia) e fica registrado no WebhookLog como FAILED", async () => {
    prismaMock.whatsappInstance.findUnique.mockRejectedValue(new Error("Can't reach database server"));
    const res = await POST(evolutionRequest(upsertBody));
    expect(res.status).toBe(500);
    expect(prismaMock.webhookLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ status: "FAILED", responseCode: 500 }),
    });
  });
});
