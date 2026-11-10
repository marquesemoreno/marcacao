import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { restartEvolutionInstance, setEvolutionWebhook } from "./evolution-admin";

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

describe("restartEvolutionInstance", () => {
  it("usa POST, o método da Evolution v2", async () => {
    const result = await restartEvolutionInstance(config);
    expect(result.success).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://evolution.exemplo/instance/restart/clinica-teste");
    expect(fetchMock.mock.calls[0][1].method).toBe("POST");
  });

  it("se a Evolution responder 404 ao POST (versão antiga), tenta PUT", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"Not Found"}', { status: 404 }));
    const result = await restartEvolutionInstance(config);
    expect(result.success).toBe(true);
    expect(fetchMock.mock.calls.map((c) => c[1].method)).toEqual(["POST", "PUT"]);
  });

  it("outro erro não tenta de novo", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"message":"Unauthorized"}', { status: 401 }));
    const result = await restartEvolutionInstance(config);
    expect(result).toEqual({ success: false, error: "HTTP 401: Unauthorized" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

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
