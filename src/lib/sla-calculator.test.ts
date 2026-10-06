import { describe, it, expect } from "vitest";
import { getSlaInfo, computeBusinessMinutesElapsed, formatSlaTime, formatDurationHuman } from "./sla-calculator";

// 2026-09-04 = sexta-feira, 2026-09-07 = segunda-feira (confirmado via Date.getUTCDay()).
const FRIDAY_19H_BRAZIL = new Date("2026-09-04T22:00:00Z"); // 19:00 Brasília (UTC-3)
const MONDAY_09H_BRAZIL = new Date("2026-09-07T12:00:00Z"); // 09:00 Brasília

describe("computeBusinessMinutesElapsed", () => {
  it("mensagem de sexta às 19h (fora do expediente) até segunda 09h vira só o tempo dentro do expediente, não ~62h corridas", () => {
    // Sexta após as 18h: 0min. Sábado 08-12h: 240min. Domingo fechado: 0min. Segunda até 09h: 60min.
    const minutes = computeBusinessMinutesElapsed(FRIDAY_19H_BRAZIL, MONDAY_09H_BRAZIL, null);
    expect(minutes).toBe(300); // 5h úteis, não 37h+
  });

  it("mensagem e resposta no mesmo dia, dentro do expediente, conta normal", () => {
    const from = new Date("2026-09-07T11:10:00Z"); // 08:10 Brasília
    const to = new Date("2026-09-07T11:22:00Z"); // 08:22 Brasília
    expect(computeBusinessMinutesElapsed(from, to, null)).toBe(12);
  });

  it("mensagem enviada depois do fechamento só começa a contar na abertura do próximo dia útil", () => {
    const fridayAfterClose = new Date("2026-09-04T21:30:00Z"); // 18:30 Brasília, já fechado
    const saturdayAtOpen = new Date("2026-09-05T11:05:00Z"); // 08:05 Brasília, sábado
    expect(computeBusinessMinutesElapsed(fridayAfterClose, saturdayAtOpen, null)).toBe(5);
  });

  it("respeita horário customizado da clínica em vez do default", () => {
    const hours = {
      seg: { open: "07:30", close: "12:00" },
      ter: { closed: true },
      qua: { closed: true },
      qui: { closed: true },
      sex: { closed: true },
      sab: { closed: true },
      dom: { closed: true },
    };
    const from = new Date("2026-09-07T10:30:00Z"); // 07:30 Brasília
    const to = new Date("2026-09-07T11:00:00Z"); // 08:00 Brasília
    expect(computeBusinessMinutesElapsed(from, to, hours)).toBe(30);
  });
});

describe("formatSlaTime", () => {
  it("minutos abaixo de 1h", () => {
    expect(formatSlaTime(4)).toBe("4m");
    expect(formatSlaTime(18)).toBe("18m");
  });

  it("1h ou mais, com e sem resto", () => {
    expect(formatSlaTime(75)).toBe("1h 15m");
    expect(formatSlaTime(120)).toBe("2h");
  });
});

describe("formatDurationHuman", () => {
  it("linguagem humana: min, h, dias", () => {
    expect(formatDurationHuman(0)).toBe("menos de 1 min");
    expect(formatDurationHuman(14)).toBe("14 min");
    expect(formatDurationHuman(60)).toBe("1 h");
    expect(formatDurationHuman(200)).toBe("3 h");
    expect(formatDurationHuman(60 * 24)).toBe("1 dia");
    expect(formatDurationHuman(60 * 24 - 20)).toBe("1 dia"); // 23h40 arredondava pra 24 h e virava "0 dias"
    expect(formatDurationHuman(60 * 24 * 2 + 300)).toBe("2 dias");
  });
});

describe("getSlaInfo", () => {
  type M = { direction: "INBOUND" | "OUTBOUND"; type: string; createdAt: Date };
  const at = (iso: string) => new Date(iso);
  const sla = (recentMessages: M[], now: Date, status = "OPEN") =>
    getSlaInfo({ recentMessages, conversationStatus: status, businessHours: null, now });

  it("não mostra espera quando a última mensagem (que não é nota) é da clínica", () => {
    const info = sla(
      [
        { direction: "OUTBOUND", type: "TEXT", createdAt: FRIDAY_19H_BRAZIL },
        { direction: "INBOUND", type: "TEXT", createdAt: new Date(FRIDAY_19H_BRAZIL.getTime() - 60000) },
      ],
      MONDAY_09H_BRAZIL
    );
    expect(info.shouldDisplay).toBe(false);
  });

  it("nota interna não conta como resposta", () => {
    const info = sla(
      [
        { direction: "OUTBOUND", type: "INTERNAL_NOTE", createdAt: at("2026-09-07T12:10:00Z") },
        { direction: "INBOUND", type: "TEXT", createdAt: at("2026-09-07T12:00:00Z") },
      ],
      at("2026-09-07T12:30:00Z")
    );
    expect(info.shouldDisplay).toBe(true);
    expect(info.formattedTime).toBe("30 min");
  });

  it("conta desde a 1ª mensagem do paciente ainda sem resposta, em tempo real", () => {
    const info = sla(
      [
        { direction: "INBOUND", type: "TEXT", createdAt: at("2026-09-07T13:00:00Z") },
        { direction: "INBOUND", type: "TEXT", createdAt: at("2026-09-07T12:00:00Z") },
        { direction: "OUTBOUND", type: "TEXT", createdAt: at("2026-09-07T11:00:00Z") },
      ],
      at("2026-09-07T14:00:00Z")
    );
    expect(info.formattedTime).toBe("2 h");
  });

  it("mensagem de ontem à noite não vira '1 min' de manhã (texto em tempo real, cor pelo expediente)", () => {
    const info = sla([{ direction: "INBOUND", type: "TEXT", createdAt: FRIDAY_19H_BRAZIL }], MONDAY_09H_BRAZIL);
    expect(info.formattedTime).toBe("2 dias");
    expect(info.waitingMinutes).toBe(300); // expediente: sábado 08–12h + segunda 08–09h
    expect(info.variant).toBe("critical");
  });

  it("não mostra quando a conversa está finalizada ou sem mensagens", () => {
    expect(sla([{ direction: "INBOUND", type: "TEXT", createdAt: FRIDAY_19H_BRAZIL }], MONDAY_09H_BRAZIL, "RESOLVED").shouldDisplay).toBe(false);
    expect(sla([], MONDAY_09H_BRAZIL).shouldDisplay).toBe(false);
  });

  it("limiares do SLA: normal < 15 min ≤ warning < 60 min ≤ critical (minutos de expediente)", () => {
    const from = at("2026-09-07T11:00:00Z"); // 08:00 Brasília, abertura
    const v = (min: number) => sla([{ direction: "INBOUND", type: "TEXT", createdAt: from }], new Date(from.getTime() + min * 60_000)).variant;
    expect(v(14)).toBe("normal");
    expect(v(15)).toBe("warning");
    expect(v(59)).toBe("warning");
    expect(v(60)).toBe("critical");
  });
});
