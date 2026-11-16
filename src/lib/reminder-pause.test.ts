import { describe, expect, it } from "vitest";
import { REMINDER_PAUSE_OPTIONS, reminderPauseUntil, remindersPausedNow } from "./reminder-pause";

const now = new Date("2026-11-16T14:30:00Z"); // seg 11h30 em Brasília

describe("reminderPauseUntil", () => {
  it("soma os dias pedidos a partir de agora", () => {
    expect(reminderPauseUntil(2, now)).toEqual(new Date("2026-11-18T14:30:00Z"));
    expect(reminderPauseUntil(1, now)).toEqual(new Date("2026-11-17T14:30:00Z"));
  });

  it("recusa valores fora das opções da tela", () => {
    expect(() => reminderPauseUntil(0, now)).toThrow();
    expect(() => reminderPauseUntil(-1, now)).toThrow();
    expect(() => reminderPauseUntil(30, now)).toThrow();
    expect(() => reminderPauseUntil(1.5, now)).toThrow();
  });

  it("todas as opções da tela são aceitas", () => {
    for (const d of REMINDER_PAUSE_OPTIONS) expect(() => reminderPauseUntil(d, now)).not.toThrow();
  });
});

describe("remindersPausedNow", () => {
  it("sem data = não pausado", () => expect(remindersPausedNow(null, now)).toBe(false));
  it("data no futuro = pausado", () => expect(remindersPausedNow(new Date("2026-11-17T00:00:00Z"), now)).toBe(true));
  it("data que já passou = voltou sozinho", () => expect(remindersPausedNow(new Date("2026-11-16T14:29:00Z"), now)).toBe(false));
});
