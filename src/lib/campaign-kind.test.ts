import { describe, expect, it } from "vitest";
import { SERVICE_NOTICE_MARK, isServiceTemplate, requiresTechnicalDirector, skipsMarketingConsent, tagToApplyOnSend } from "./campaign-kind";
import { RESCHEDULE_PENDING_TAG } from "./conversation-tags";

describe("tipo da campanha", () => {
  it("só aviso de remarcação e aviso de serviço dispensam o aceite de marketing", () => {
    expect(skipsMarketingConsent(RESCHEDULE_PENDING_TAG)).toBe(true);
    expect(skipsMarketingConsent(SERVICE_NOTICE_MARK)).toBe(true);
    expect(skipsMarketingConsent(null)).toBe(false);
    expect(skipsMarketingConsent("Outubro Rosa")).toBe(false);
  });

  it("responsável técnico é exigido só em campanha de marketing", () => {
    expect(requiresTechnicalDirector(null)).toBe(true);
    expect(requiresTechnicalDirector("Outubro Rosa")).toBe(true);
    expect(requiresTechnicalDirector(RESCHEDULE_PENDING_TAG)).toBe(false);
    expect(requiresTechnicalDirector(SERVICE_NOTICE_MARK)).toBe(false);
  });

  it("a marca de aviso de serviço nunca vira tag na conversa", () => {
    expect(tagToApplyOnSend(SERVICE_NOTICE_MARK)).toBeNull();
    expect(tagToApplyOnSend(null)).toBeNull();
    expect(tagToApplyOnSend(RESCHEDULE_PENDING_TAG)).toBe(RESCHEDULE_PENDING_TAG);
    expect(tagToApplyOnSend("Outubro Rosa")).toBe("Outubro Rosa");
  });

  it("aviso de serviço só com modelo da categoria Utilidade da Meta", () => {
    expect(isServiceTemplate({ category: "UTILITY" })).toBe(true);
    expect(isServiceTemplate({ category: "utility" })).toBe(true);
    expect(isServiceTemplate({ category: "MARKETING" })).toBe(false);
    expect(isServiceTemplate({ category: "AUTHENTICATION" })).toBe(false);
  });
});
