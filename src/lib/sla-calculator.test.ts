import { describe, it, expect } from "vitest";
import { getSlaInfo, computeBusinessMinutesElapsed, formatSlaTime } from "./sla-calculator";

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

describe("getSlaInfo", () => {
  it("não mostra SLA quando a última mensagem já é da clínica (OUTBOUND)", () => {
    const info = getSlaInfo({
      lastMessage: { direction: "OUTBOUND", createdAt: FRIDAY_19H_BRAZIL },
      conversationStatus: "OPEN",
      businessHours: null,
      now: MONDAY_09H_BRAZIL,
    });
    expect(info.shouldDisplay).toBe(false);
  });

  it("não mostra SLA quando a conversa está finalizada", () => {
    const info = getSlaInfo({
      lastMessage: { direction: "INBOUND", createdAt: FRIDAY_19H_BRAZIL },
      conversationStatus: "RESOLVED",
      businessHours: null,
      now: MONDAY_09H_BRAZIL,
    });
    expect(info.shouldDisplay).toBe(false);
  });

  it("não mostra SLA quando não há mensagem nenhuma", () => {
    const info = getSlaInfo({ lastMessage: null, conversationStatus: "OPEN", businessHours: null });
    expect(info.shouldDisplay).toBe(false);
  });

  it("classifica variant normal/warning/critical pelos limiares em minutos úteis", () => {
    const from = new Date("2026-09-07T11:00:00Z"); // 08:00 Brasília, abertura
    const normal = getSlaInfo({
      lastMessage: { direction: "INBOUND", createdAt: from },
      conversationStatus: "OPEN",
      businessHours: null,
      now: new Date(from.getTime() + 5 * 60_000),
    });
    expect(normal.variant).toBe("normal");

    const warning = getSlaInfo({
      lastMessage: { direction: "INBOUND", createdAt: from },
      conversationStatus: "OPEN",
      businessHours: null,
      now: new Date(from.getTime() + 15 * 60_000),
    });
    expect(warning.variant).toBe("warning");

    const critical = getSlaInfo({
      lastMessage: { direction: "INBOUND", createdAt: from },
      conversationStatus: "OPEN",
      businessHours: null,
      now: new Date(from.getTime() + 25 * 60_000),
    });
    expect(critical.variant).toBe("critical");
  });
});
