import { describe, it, expect } from "vitest";
import { channelSendDecision, consentAddress } from "./channel-consent";

const t = (iso: string) => new Date(iso);

describe("channelSendDecision", () => {
  it("sem consentimento registrado não envia", () => {
    expect(channelSendDecision({ consentAt: null, revokedAt: null })).toBe("SEM_CONSENTIMENTO");
  });

  it("com consentimento e sem saída, envia", () => {
    expect(channelSendDecision({ consentAt: t("2026-10-01T10:00:00Z"), revokedAt: null })).toBe("ENVIAR");
  });

  it("saída depois do consentimento: não envia", () => {
    expect(channelSendDecision({ consentAt: t("2026-10-01T10:00:00Z"), revokedAt: t("2026-10-05T10:00:00Z") })).toBe("SAIU");
  });

  it("novo consentimento depois da saída volta a enviar", () => {
    expect(channelSendDecision({ consentAt: t("2026-10-10T10:00:00Z"), revokedAt: t("2026-10-05T10:00:00Z") })).toBe("ENVIAR");
  });

  it("saída e consentimento no mesmo instante: na dúvida, não envia", () => {
    expect(channelSendDecision({ consentAt: t("2026-10-05T10:00:00Z"), revokedAt: t("2026-10-05T10:00:00Z") })).toBe("SAIU");
  });

  it("saída sem consentimento registrado continua sem enviar", () => {
    expect(channelSendDecision({ consentAt: null, revokedAt: t("2026-10-05T10:00:00Z") })).toBe("SAIU");
  });
});

describe("consentAddress", () => {
  it("e-mail: minúsculo e sem espaços", () => {
    expect(consentAddress("EMAIL", "  Maria@X.com ")).toBe("maria@x.com");
  });

  it("SMS: número no formato 55DDD9XXXXXXXX", () => {
    expect(consentAddress("SMS", "(77) 99999-1234")).toBe("5577999991234");
  });

  it("endereço inválido vira null (não grava consentimento em lixo)", () => {
    expect(consentAddress("EMAIL", "sem-arroba")).toBeNull();
    expect(consentAddress("SMS", "7733221234")).toBeNull();
  });
});
