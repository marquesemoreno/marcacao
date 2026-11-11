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

const evolutionRequest = (body: unknown, token?: string) =>
  new Request("https://exemplo.com.br/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { "x-webhook-token": token } : {}) },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
  delete process.env.WHATSAPP_WEBHOOK_ENFORCE;
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

  it("registra a chegada de mensagem só com instância, token e resultado (nada do paciente)", async () => {
    prismaMock.message.findUnique.mockResolvedValue({ id: "msg1" });
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    await POST(evolutionRequest(upsertBody));
    const line = log.mock.calls.map((c) => c.join(" ")).find((l) => l.includes("wa_webhook"));
    expect(line).toBeDefined();
    expect(JSON.parse(line!)).toEqual({
      event: "wa_webhook",
      instance: "clinica-teste",
      kind: "messages.upsert",
      token: "open",
      jid: "pn",
      fromMe: false,
      delaySec: null,
      http: 200,
      result: "duplicate",
    });
    expect(line).not.toContain("5577988887777");
    expect(line).not.toContain("Maria");
    log.mockRestore();
  });

  describe("segredo do webhook", () => {
    beforeEach(() => {
      process.env.WHATSAPP_WEBHOOK_SECRET = "s3gredo";
      prismaMock.message.findUnique.mockResolvedValue({ id: "msg1" });
    });

    it("preparo: com segredo e sem a trava, mensagem sem cabeçalho ainda é aceita e avisa só a instância", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = await POST(evolutionRequest(upsertBody));
      expect(res.status).toBe(200);
      const logged = warn.mock.calls.flat().join(" ");
      expect(logged).toContain("clinica-teste");
      expect(logged).not.toContain("5577988887777");
      expect(logged).not.toContain("Maria");
      warn.mockRestore();
    });

    it("trava ligada: mensagem sem cabeçalho ou com token errado é recusada com 401", async () => {
      process.env.WHATSAPP_WEBHOOK_ENFORCE = "1";
      expect((await POST(evolutionRequest(upsertBody))).status).toBe(401);
      expect((await POST(evolutionRequest(upsertBody, "errado"))).status).toBe(401);
      expect(prismaMock.message.findUnique).not.toHaveBeenCalled();
    });

    it("trava ligada: mensagem com o token certo passa", async () => {
      process.env.WHATSAPP_WEBHOOK_ENFORCE = "1";
      const res = await POST(evolutionRequest(upsertBody, "s3gredo"));
      expect(res.status).toBe(200);
    });
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
