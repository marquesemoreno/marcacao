import { describe, expect, it } from "vitest";
import { isWithinReminderWindow, shouldSendReminder } from "./automated-pacing";

const br = (iso: string) => new Date(`${iso}-03:00`);

describe("isWithinReminderWindow", () => {
  it("08:00–18:00 de Brasília, qualquer dia", () => {
    expect(isWithinReminderWindow(br("2026-10-06T07:59:00"))).toBe(false);
    expect(isWithinReminderWindow(br("2026-10-06T08:00:00"))).toBe(true);
    expect(isWithinReminderWindow(br("2026-10-04T12:00:00"))).toBe(true); // domingo
    expect(isWithinReminderWindow(br("2026-10-06T18:00:00"))).toBe(false);
  });
});

describe("shouldSendReminder (intercalando com a campanha)", () => {
  const base = { inWindow: true, gapElapsed: true, lastKind: null as "reminder" | "campaign" | null, campaignReady: false };
  it("fora do horário ou antes do intervalo: não", () => {
    expect(shouldSendReminder({ ...base, inWindow: false })).toBe(false);
    expect(shouldSendReminder({ ...base, gapElapsed: false })).toBe(false);
  });
  it("sem campanha esperando: manda um lembrete por intervalo", () => {
    expect(shouldSendReminder({ ...base, lastKind: "reminder" })).toBe(true);
  });
  it("última foi lembrete e há campanha esperando: a vez é da campanha", () => {
    expect(shouldSendReminder({ ...base, lastKind: "reminder", campaignReady: true })).toBe(false);
  });
  it("última foi campanha: a vez é do lembrete", () => {
    expect(shouldSendReminder({ ...base, lastKind: "campaign", campaignReady: true })).toBe(true);
  });
});
