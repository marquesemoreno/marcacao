import { describe, expect, it } from "vitest";
import { marketingSendDecision, isMarketingOptInReply } from "./marketing-consent";

describe("marketingSendDecision", () => {
  const base = { optedOut: false, consentAt: null as Date | null, isMarcador: false, isTransactional: false };
  it("campanha de marketing só vai para quem consentiu", () => {
    expect(marketingSendDecision(base)).toBe("SEM_CONSENTIMENTO");
    expect(marketingSendDecision({ ...base, consentAt: new Date() })).toBe("ENVIAR");
  });
  it("pediu para sair vence o consentimento", () => {
    expect(marketingSendDecision({ ...base, consentAt: new Date(), optedOut: true })).toBe("SAIU");
  });
  it("aviso de remarcação (transacional) e marcadores (parceiros) não exigem consentimento", () => {
    expect(marketingSendDecision({ ...base, isTransactional: true })).toBe("ENVIAR");
    expect(marketingSendDecision({ ...base, isMarcador: true })).toBe("ENVIAR");
  });
});

describe("isMarketingOptInReply", () => {
  it("reconhece o pedido de entrar na lista", () => {
    expect(isMarketingOptInReply("QUERO RECEBER")).toBe(true);
    expect(isMarketingOptInReply("quero receber as novidades")).toBe(true);
    expect(isMarketingOptInReply("sim")).toBe(false);
    expect(isMarketingOptInReply("não quero receber")).toBe(false);
  });
});
