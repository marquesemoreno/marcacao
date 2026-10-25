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

import { parseConsentList, planConsentChanges } from "./channel-consent";

describe("parseConsentList", () => {
  it("e-mails separados por linha, vírgula ou ponto e vírgula; sem repetir; separa os inválidos", () => {
    const out = parseConsentList("EMAIL", "a@x.com, B@X.com;\n a@x.com\nlixo");
    expect(out.addresses).toEqual(["a@x.com", "b@x.com"]);
    expect(out.invalid).toEqual(["lixo"]);
  });

  it("telefones com máscara viram 55DDD9XXXXXXXX; fixo é inválido", () => {
    const out = parseConsentList("SMS", "(77) 99999-1234\n7733221234");
    expect(out.addresses).toEqual(["5577999991234"]);
    expect(out.invalid).toEqual(["7733221234"]);
  });

  it("linhas vazias são ignoradas", () => {
    expect(parseConsentList("EMAIL", "\n\n  \n")).toEqual({ addresses: [], invalid: [] });
  });
});

describe("planConsentChanges", () => {
  const existing = new Map([
    ["ativo@x.com", { consentAt: t("2026-10-01T10:00:00Z"), revokedAt: null }],
    ["saiu@x.com", { consentAt: t("2026-10-01T10:00:00Z"), revokedAt: t("2026-10-05T10:00:00Z") }],
    ["voltou@x.com", { consentAt: t("2026-10-10T10:00:00Z"), revokedAt: t("2026-10-05T10:00:00Z") }],
  ]);

  it("endereço novo: cria", () => {
    expect(planConsentChanges(existing, ["novo@x.com"])).toEqual({ create: ["novo@x.com"], renew: [], already: 0 });
  });

  it("já consentido e ativo: não mexe (preserva a data do aceite original)", () => {
    expect(planConsentChanges(existing, ["ativo@x.com", "voltou@x.com"])).toEqual({ create: [], renew: [], already: 2 });
  });

  it("quem saiu e aceita de novo: renova o consentimento", () => {
    expect(planConsentChanges(existing, ["saiu@x.com"])).toEqual({ create: [], renew: ["saiu@x.com"], already: 0 });
  });
});
