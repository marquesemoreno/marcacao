import { describe, it, expect, vi } from "vitest";
import { sendEmailViaResend } from "./resend";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

const params = {
  apiKey: "re_test_123",
  from: "Clínica <avisos@clinica.com.br>",
  to: "maria@x.com",
  subject: "Olá",
  html: "<p>Oi</p>",
  text: "Oi",
  headers: { "List-Unsubscribe": "<https://x/u/1>" },
  idempotencyKey: "recipient-1",
};

describe("sendEmailViaResend", () => {
  it("envia para a API do Resend com chave, corpo e chave de idempotência", async () => {
    const fetchImpl = fakeFetch(200, { id: "email_abc" });
    const out = await sendEmailViaResend(params, fetchImpl as unknown as typeof fetch);
    expect(out).toEqual({ success: true, id: "email_abc" });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.method).toBe("POST");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer re_test_123");
    expect(headers["Idempotency-Key"]).toBe("recipient-1");
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({
      from: params.from,
      to: ["maria@x.com"],
      subject: "Olá",
      html: "<p>Oi</p>",
      text: "Oi",
      headers: params.headers,
    });
  });

  it("erro da API vira falha com a mensagem, sem lançar", async () => {
    const fetchImpl = fakeFetch(422, { name: "validation_error", message: "Invalid `to` field" });
    const out = await sendEmailViaResend(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("Invalid `to` field");
  });

  it("chave inválida (401) vira falha legível", async () => {
    const fetchImpl = fakeFetch(401, { message: "API key is invalid" });
    const out = await sendEmailViaResend(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("401");
  });

  it("falha de rede vira falha, sem lançar", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("ECONNRESET");
    });
    const out = await sendEmailViaResend(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("ECONNRESET");
  });

  it("resposta de sucesso sem id ainda conta como sucesso", async () => {
    const fetchImpl = fakeFetch(200, {});
    const out = await sendEmailViaResend(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(true);
    expect(out.id).toBeUndefined();
  });
});
