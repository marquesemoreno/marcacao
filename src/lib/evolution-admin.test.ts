import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { setEvolutionWebhook } from "./evolution-admin";

const config = { apiUrl: "https://evolution.exemplo", apiKey: "k", instanceName: "clinica-teste" };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.WHATSAPP_WEBHOOK_SECRET;
});

const sentWebhook = () => JSON.parse(fetchMock.mock.calls[0][1].body as string).webhook;

describe("setEvolutionWebhook", () => {
  it("com o segredo configurado, manda a Evolution enviar o cabeçalho x-webhook-token", async () => {
    process.env.WHATSAPP_WEBHOOK_SECRET = "s3gredo";
    const result = await setEvolutionWebhook(config);
    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe("https://evolution.exemplo/webhook/set/clinica-teste");
    expect(sentWebhook().headers).toEqual({ "x-webhook-token": "s3gredo" });
  });

  it("sem o segredo, registra o webhook sem cabeçalho (como antes)", async () => {
    await setEvolutionWebhook(config);
    const webhook = sentWebhook();
    expect(webhook.headers).toBeUndefined();
    expect(webhook.events).toContain("MESSAGES_UPSERT");
    expect(webhook.enabled).toBe(true);
  });
});
