import { describe, expect, it } from "vitest";
import { numberHealth } from "./number-health";

const now = new Date("2026-11-02T14:00:00Z");
const base = { connection: "open" as const, onCloud: false, lastDownAt: null, automatedToday: 10, failedToday: 0, now };

describe("numberHealth", () => {
  it("número conectado, sem quedas e volume normal → ok, sem confirmação extra", () => {
    const h = numberHealth(base);
    expect(h.tone).toBe("ok");
    expect(h.needsAck).toBe(false);
    expect(h.blocksStart).toBe(false);
  });

  it("número desconectado bloqueia o início", () => {
    const h = numberHealth({ ...base, connection: "down" });
    expect(h.tone).toBe("danger");
    expect(h.blocksStart).toBe(true);
  });

  it("queda nos últimos 30 dias sozinha só avisa (sem confirmação)", () => {
    const h = numberHealth({ ...base, lastDownAt: new Date("2026-10-20T12:00:00Z") });
    expect(h.tone).toBe("warn");
    expect(h.needsAck).toBe(false);
    expect(h.reasons.join(" ")).toContain("20/10");
  });

  it("queda recente + campanha longa juntas pedem confirmação", () => {
    const h = numberHealth({ ...base, automatedToday: 0, lastDownAt: new Date("2026-10-20T12:00:00Z"), campaignPending: 60 + 200 });
    expect(h.needsAck).toBe(true);
  });

  it("queda há mais de 30 dias não alerta", () => {
    expect(numberHealth({ ...base, lastDownAt: new Date("2026-09-20T12:00:00Z") }).tone).toBe("ok");
  });

  it("falhas automáticas hoje ou volume perto do limite pedem confirmação", () => {
    expect(numberHealth({ ...base, failedToday: 2 }).needsAck).toBe(true);
    expect(numberHealth({ ...base, automatedToday: 80 }).needsAck).toBe(true);
  });

  it("conta a própria campanha: dia calmo + campanha grande também alerta", () => {
    const h = numberHealth({ ...base, automatedToday: 5, campaignPending: 600 });
    expect(h.needsAck).toBe(true);
    expect(h.reasons.join(" ")).toContain("até 105");
    expect(h.reasons.join(" ")).toContain("pelo menos 6 dias úteis");
  });

  it("padrão do bloqueio da Santa Clara (~115 em 4 dias) já pede confirmação antes de chegar lá", () => {
    // 115 em 4 dias ≈ 29/dia; com 5 dias nesse ritmo já são ~145–150.
    expect(numberHealth({ ...base, automatedToday: 29, automated7d: 150 }).needsAck).toBe(true);
    expect(numberHealth({ ...base, automatedToday: 29, automated7d: 115 }).needsAck).toBe(false);
  });

  it("dia calmo mas semana pesada alerta", () => {
    const h = numberHealth({ ...base, automatedToday: 5, automated7d: 300 });
    expect(h.needsAck).toBe(true);
    expect(h.reasons.join(" ")).toContain("7 dias");
  });

  it("campanha pequena num dia calmo segue ok", () => {
    expect(numberHealth({ ...base, automatedToday: 5, campaignPending: 30 }).tone).toBe("ok");
  });

  it("API oficial: sem risco de bloqueio por celular", () => {
    const h = numberHealth({ ...base, onCloud: true, lastDownAt: new Date("2026-10-20T12:00:00Z"), failedToday: 5 });
    expect(h.tone).toBe("ok");
    expect(h.needsAck).toBe(false);
  });
});
