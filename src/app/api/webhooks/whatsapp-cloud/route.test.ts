import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    cloudTestMessage: { updateMany: vi.fn() },
    webhookLog: { create: vi.fn() },
    whatsappCloudAccount: { findMany: vi.fn() },
    message: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    contact: { findFirst: vi.fn(), create: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/supabase-server", () => ({ notifyInboxRealtime: vi.fn().mockResolvedValue(undefined) }));

import { POST } from "./route";

const APP_SECRET = "segredo-do-app-de-teste";

/** Mensagem de texto recebida no número PN1, como a Meta manda. */
const inboundBody = {
  object: "whatsapp_business_account",
  entry: [{
    id: "WABA1",
    changes: [{
      field: "messages",
      value: {
        metadata: { phone_number_id: "PN1", display_phone_number: "5577999708403" },
        contacts: [{ wa_id: "5577988887777", profile: { name: "Maria" } }],
        messages: [{ id: "wamid.A", from: "5577988887777", timestamp: "1791300000", type: "text", text: { body: "Oi" } }],
      },
    }],
  }],
};

function metaRequest(body: unknown) {
  const raw = JSON.stringify(body);
  const signature = "sha256=" + createHmac("sha256", APP_SECRET).update(raw).digest("hex");
  return new Request("https://exemplo.com.br/api/webhooks/whatsapp-cloud", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-hub-signature-256": signature },
    body: raw,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.META_APP_SECRET = APP_SECRET;
  // Sem CRON_SECRET o encaminhamento pra automação fica desligado e a rota grava direto.
  delete process.env.CRON_SECRET;
  prismaMock.cloudTestMessage.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.webhookLog.create.mockResolvedValue({});
  prismaMock.whatsappCloudAccount.findMany.mockResolvedValue([{ phoneNumberId: "PN1", clinicId: "clinic1", active: true }]);
  prismaMock.message.findUnique.mockResolvedValue(null);
  prismaMock.message.create.mockResolvedValue({ id: "msg1" });
  prismaMock.contact.findFirst.mockResolvedValue({ id: "contact1" });
  prismaMock.conversation.findFirst.mockResolvedValue({ id: "conv1" });
  prismaMock.conversation.update.mockResolvedValue({});
});

describe("POST /api/webhooks/whatsapp-cloud", () => {
  it("grava a mensagem recebida e responde 200", async () => {
    const res = await POST(metaRequest(inboundBody));
    expect(res.status).toBe(200);
    expect(prismaMock.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "conv1", direction: "INBOUND", content: "Oi", whatsappKeyId: "wamid.A" }),
    });
  });

  it("se a gravação falhar (banco fora), responde 5xx para a Meta reenviar a mensagem", async () => {
    prismaMock.message.create.mockRejectedValue(new Error("Can't reach database server"));
    const res = await POST(metaRequest(inboundBody));
    expect(res.status).toBeGreaterThanOrEqual(500);
  });

  it("reenvio de mensagem já gravada responde 200 sem gravar de novo", async () => {
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg1" });
    const res = await POST(metaRequest(inboundBody));
    expect(res.status).toBe(200);
    expect(prismaMock.message.create).not.toHaveBeenCalled();
  });

  it("assinatura inválida continua 401", async () => {
    const req = new Request("https://exemplo.com.br/api/webhooks/whatsapp-cloud", {
      method: "POST",
      headers: { "x-hub-signature-256": "sha256=00" },
      body: JSON.stringify(inboundBody),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
