import { describe, expect, it } from "vitest";
import { allowsNinthDigitFallback } from "./ninth-digit-policy";

describe("allowsNinthDigitFallback", () => {
  it("resposta da atendente no chat pode tentar o número com o 9º dígito trocado", () => {
    expect(allowsNinthDigitFallback("chat.outbound.media")).toBe(true);
    expect(allowsNinthDigitFallback("chat.retry.audio")).toBe(true);
  });
  it("envio automático (lembrete, disparo, confirmação, IA) nunca tenta outro número", () => {
    expect(allowsNinthDigitFallback("appointment.bridge_reminder_d1")).toBe(false);
    expect(allowsNinthDigitFallback("broadcast.sent")).toBe(false);
    expect(allowsNinthDigitFallback("appointment.confirmation")).toBe(false);
    expect(allowsNinthDigitFallback("whatsapp.send")).toBe(false);
  });
});
