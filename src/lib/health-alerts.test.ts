import { describe, expect, it } from "vitest";
import { nextHealthState, isBridgeCheckWindow } from "./health-alerts";

describe("nextHealthState", () => {
  it("1ª falha só fica suspeita, sem alerta", () => {
    expect(nextHealthState("ok", false)).toEqual({ state: "suspect", alert: null });
  });
  it("2ª falha seguida vira fora do ar e alerta", () => {
    expect(nextHealthState("suspect", false)).toEqual({ state: "down", alert: "down" });
  });
  it("continua fora do ar sem repetir alerta", () => {
    expect(nextHealthState("down", false)).toEqual({ state: "down", alert: null });
  });
  it("voltou depois de fora do ar avisa recuperação", () => {
    expect(nextHealthState("down", true)).toEqual({ state: "ok", alert: "recovered" });
  });
  it("suspeita que se resolve não avisa nada", () => {
    expect(nextHealthState("suspect", true)).toEqual({ state: "ok", alert: null });
  });
  it("sem histórico conta como ok", () => {
    expect(nextHealthState(undefined, true)).toEqual({ state: "ok", alert: null });
  });
});

describe("isBridgeCheckWindow (computador da clínica fica desligado à noite)", () => {
  it("terça 10h BRT checa", () => expect(isBridgeCheckWindow(new Date("2026-11-03T13:00:00Z"))).toBe(true));
  it("terça 20h BRT não checa", () => expect(isBridgeCheckWindow(new Date("2026-11-03T23:00:00Z"))).toBe(false));
  it("domingo não checa", () => expect(isBridgeCheckWindow(new Date("2026-11-01T13:00:00Z"))).toBe(false));
  it("sábado 10h checa, 14h não", () => {
    expect(isBridgeCheckWindow(new Date("2026-10-31T13:00:00Z"))).toBe(true);
    expect(isBridgeCheckWindow(new Date("2026-10-31T17:00:00Z"))).toBe(false);
  });
});
