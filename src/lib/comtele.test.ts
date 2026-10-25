import { describe, it, expect, vi } from "vitest";
import { sendSmsViaComtele } from "./comtele";

function fakeFetch(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

const params = {
  apiKey: "11111111-2222-3333-4444-555555555555",
  route: 17,
  number: "5577999991234",
  message: "Oi Maria",
  tag: "campanha-123",
};

describe("sendSmsViaComtele", () => {
  it("envia para a API nova da Comtele com x-api-key e o corpo documentado", async () => {
    const fetchImpl = fakeFetch(200, { hasError: false, message: "ok", totalRecords: 1, errors: null, object: null });
    const out = await sendSmsViaComtele(params, fetchImpl as unknown as typeof fetch);
    expect(out).toEqual({ success: true });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.comtele.com.br/messages/sms/send");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe(params.apiKey);
    expect(JSON.parse(init.body as string)).toEqual({
      receivers: [5577999991234],
      contactGroups: [],
      message: "Oi Maria",
      route: 17,
      tag: "campanha-123",
      custom: "campanha-123",
      scheduleDate: null,
    });
  });

  it("hasError=true vira falha com a mensagem e a lista de erros", async () => {
    const fetchImpl = fakeFetch(200, { hasError: true, message: "Saldo insuficiente", totalRecords: 0, errors: ["sem crédito"], object: null });
    const out = await sendSmsViaComtele(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("Saldo insuficiente");
    expect(out.error).toContain("sem crédito");
  });

  it("401 (chave errada) vira falha legível", async () => {
    const fetchImpl = fakeFetch(401, {});
    const out = await sendSmsViaComtele(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("401");
  });

  it("corpo que não é JSON não derruba o envio", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>erro</html>", { status: 502 }));
    const out = await sendSmsViaComtele(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("502");
  });

  it("falha de rede vira falha, sem lançar", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error("timeout");
    });
    const out = await sendSmsViaComtele(params, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(out.error).toContain("timeout");
  });

  it("recusa número que não é só dígitos antes de chamar a API", async () => {
    const fetchImpl = fakeFetch(200, {});
    const out = await sendSmsViaComtele({ ...params, number: "77 9999" }, fetchImpl as unknown as typeof fetch);
    expect(out.success).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
