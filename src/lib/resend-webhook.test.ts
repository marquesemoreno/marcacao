import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { resendEventStatus, shouldApplyDelivery, verifyResendSignature } from "./resend-webhook";

const secret = `whsec_${Buffer.from("segredo-de-teste").toString("base64")}`;
const sign = (id: string, ts: string, body: string) =>
  createHmac("sha256", Buffer.from("segredo-de-teste")).update(`${id}.${ts}.${body}`).digest("base64");

describe("verifyResendSignature", () => {
  const body = '{"type":"email.delivered"}';
  it("aceita assinatura certa dentro do prazo, mesmo com várias versões no cabeçalho", () => {
    expect(verifyResendSignature({ secret, id: "msg_1", timestamp: "1000", signature: `v1,errada v1,${sign("msg_1", "1000", body)}`, body, nowS: 1100 })).toBe(true);
  });
  it("recusa corpo alterado, assinatura ausente ou carimbo velho", () => {
    const sig = `v1,${sign("msg_1", "1000", body)}`;
    expect(verifyResendSignature({ secret, id: "msg_1", timestamp: "1000", signature: sig, body: body + " ", nowS: 1100 })).toBe(false);
    expect(verifyResendSignature({ secret, id: "msg_1", timestamp: "1000", signature: null, body, nowS: 1100 })).toBe(false);
    expect(verifyResendSignature({ secret, id: "msg_1", timestamp: "1000", signature: sig, body, nowS: 1000 + 301 })).toBe(false);
    expect(verifyResendSignature({ secret: "", id: "msg_1", timestamp: "1000", signature: sig, body, nowS: 1100 })).toBe(false);
  });
});

describe("resendEventStatus / shouldApplyDelivery", () => {
  it("traduz os eventos de entrega e ignora os outros", () => {
    expect(resendEventStatus("email.delivered")).toBe("DELIVERED");
    expect(resendEventStatus("email.bounced")).toBe("BOUNCED");
    expect(resendEventStatus("email.complained")).toBe("COMPLAINED");
    expect(resendEventStatus("email.opened")).toBeNull();
  });
  it("evento fora de ordem não rebaixa o status", () => {
    expect(shouldApplyDelivery(null, "DELAYED")).toBe(true);
    expect(shouldApplyDelivery("DELIVERED", "DELAYED")).toBe(false);
    expect(shouldApplyDelivery("DELIVERED", "BOUNCED")).toBe(true);
    expect(shouldApplyDelivery("COMPLAINED", "DELIVERED")).toBe(false);
  });
});
