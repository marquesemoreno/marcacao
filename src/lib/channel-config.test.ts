import { describe, it, expect } from "vitest";
import { missingChannelConfig } from "./channel-config";

describe("missingChannelConfig", () => {
  it("WhatsApp não depende de nada daqui", () => {
    expect(missingChannelConfig("WHATSAPP", {})).toEqual([]);
  });

  it("SMS sem nada configurado lista tudo que falta", () => {
    expect(missingChannelConfig("SMS", {})).toEqual(["COMTELE_API_KEY", "COMTELE_ROUTE", "UNSUBSCRIBE_SECRET"]);
  });

  it("SMS completo não falta nada", () => {
    expect(missingChannelConfig("SMS", { COMTELE_API_KEY: "k", COMTELE_ROUTE: "17", UNSUBSCRIBE_SECRET: "s" })).toEqual([]);
  });

  it("rota da Comtele precisa ser um número inteiro", () => {
    expect(missingChannelConfig("SMS", { COMTELE_API_KEY: "k", COMTELE_ROUTE: "abc", UNSUBSCRIBE_SECRET: "s" })).toEqual(["COMTELE_ROUTE"]);
  });

  it("e-mail sem nada configurado lista tudo que falta", () => {
    expect(missingChannelConfig("EMAIL", {})).toEqual(["RESEND_API_KEY", "BROADCAST_EMAIL_FROM", "UNSUBSCRIBE_SECRET"]);
  });

  it("valor só com espaços conta como ausente", () => {
    expect(missingChannelConfig("EMAIL", { RESEND_API_KEY: "  ", BROADCAST_EMAIL_FROM: "a@b.com", UNSUBSCRIBE_SECRET: "s" })).toEqual(["RESEND_API_KEY"]);
  });
});
