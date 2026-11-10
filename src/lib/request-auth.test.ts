import { describe, it, expect } from "vitest";
import { isCronAuthorized, isInternalSecretAuthorized, isWebhookTokenAuthorized } from "./request-auth";

describe("isCronAuthorized", () => {
  it("aceita o Bearer certo", () => {
    expect(isCronAuthorized("Bearer s3cret", "s3cret")).toBe(true);
  });

  it("recusa Bearer errado, ausente ou de tamanho diferente", () => {
    expect(isCronAuthorized("Bearer outro", "s3cret")).toBe(false);
    expect(isCronAuthorized(null, "s3cret")).toBe(false);
    expect(isCronAuthorized("Bearer s3cre", "s3cret")).toBe(false);
  });

  it("recusa tudo quando CRON_SECRET não está configurado (nunca aceita 'Bearer undefined')", () => {
    expect(isCronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(isCronAuthorized("Bearer ", "")).toBe(false);
    expect(isCronAuthorized(null, undefined)).toBe(false);
  });
});

describe("isWebhookTokenAuthorized", () => {
  it("sem segredo configurado, mantém o comportamento atual (aceita)", () => {
    expect(isWebhookTokenAuthorized(null, undefined)).toBe(true);
    expect(isWebhookTokenAuthorized("qualquer", "")).toBe(true);
  });

  it("com segredo configurado, exige o mesmo token", () => {
    expect(isWebhookTokenAuthorized("abc", "abc")).toBe(true);
    expect(isWebhookTokenAuthorized("abd", "abc")).toBe(false);
    expect(isWebhookTokenAuthorized(null, "abc")).toBe(false);
    expect(isWebhookTokenAuthorized("abcd", "abc")).toBe(false);
  });
});

describe("isInternalSecretAuthorized", () => {
  it("aceita só o mesmo segredo", () => {
    expect(isInternalSecretAuthorized("s3cret", "s3cret")).toBe(true);
    expect(isInternalSecretAuthorized("s3creT", "s3cret")).toBe(false);
    expect(isInternalSecretAuthorized("s3cre", "s3cret")).toBe(false);
    expect(isInternalSecretAuthorized(null, "s3cret")).toBe(false);
  });

  it("sem segredo configurado recusa tudo (encaminhamento interno fica desligado)", () => {
    expect(isInternalSecretAuthorized("", undefined)).toBe(false);
    expect(isInternalSecretAuthorized("", "")).toBe(false);
    expect(isInternalSecretAuthorized("undefined", undefined)).toBe(false);
  });
});
