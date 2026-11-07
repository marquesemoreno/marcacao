import { describe, expect, it } from "vitest";
import { autoCloseHint, businessHoursBetween, decideAutoClose, endingFromJevAnswer, hasSchedulingMessage } from "./conversation-auto-close";

// America/Bahia = UTC-3 fixo. 2026-10-09 é sexta.
const br = (iso: string) => new Date(`${iso}-03:00`);

describe("businessHoursBetween (08–18h, seg–sáb)", () => {
  it("dentro do mesmo dia útil", () => {
    expect(businessHoursBetween(br("2026-10-09T09:00:00"), br("2026-10-09T13:30:00"))).toBeCloseTo(4.5);
  });
  it("noite não conta: 17h → 9h do dia seguinte = 2h", () => {
    expect(businessHoursBetween(br("2026-10-08T17:00:00"), br("2026-10-09T09:00:00"))).toBeCloseTo(2);
  });
  it("domingo não conta: sáb 17h → seg 9h = 2h", () => {
    expect(businessHoursBetween(br("2026-10-10T17:00:00"), br("2026-10-12T09:00:00"))).toBeCloseTo(2);
  });
  it("mensagem de madrugada começa a contar às 8h", () => {
    expect(businessHoursBetween(br("2026-10-09T02:00:00"), br("2026-10-09T10:00:00"))).toBeCloseTo(2);
  });
  it("fim antes do início = 0", () => {
    expect(businessHoursBetween(br("2026-10-09T10:00:00"), br("2026-10-09T09:00:00"))).toBe(0);
  });
});

const base = { lastDirection: "OUTBOUND" as const, pinned: false, inWindow: true, paused: false, ending: "AWAITING" as const };

describe("decideAutoClose", () => {
  it("menos de 4h úteis: não mexe", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 3.9 })).toBe("skip");
  });
  it("paciente falou por último ou conversa fixada: fica aberta", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 30, lastDirection: "INBOUND" })).toBe("skip");
    expect(decideAutoClose({ ...base, idleBusinessHours: 30, pinned: true })).toBe("skip");
    expect(decideAutoClose({ ...base, idleBusinessHours: 30, lastDirection: null })).toBe("skip");
  });
  it("esperando o paciente, 4h úteis: avisa e fecha", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 4 })).toBe("notify_and_close");
  });
  it("fora do horário espera pra poder avisar", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 5, inWindow: false })).toBe("skip");
  });
  it("clínica pausada ou acumulado antigo (20h úteis+, ~2 dias) fecha sem avisar", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 5, paused: true })).toBe("close_inactive");
    expect(decideAutoClose({ ...base, idleBusinessHours: 20 })).toBe("close_inactive");
  });
  it("conversa que terminou naturalmente fecha como concluída, sem aviso", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 4, ending: "CONCLUDED", inWindow: false })).toBe("close_concluded");
  });
  it("na dúvida, fecha sem aviso", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 4, ending: "UNSURE" })).toBe("close_inactive");
  });
});

describe("endingFromJevAnswer", () => {
  it("aceita só com confiança alta", () => {
    expect(endingFromJevAnswer({ type: "choice", choice: "CONCLUDED", confidence: 0.9 })).toBe("CONCLUDED");
    expect(endingFromJevAnswer({ type: "choice", choice: "AWAITING", confidence: 0.6 })).toBe("UNSURE");
  });
  it("Jev indisponível ou resposta estranha = dúvida", () => {
    expect(endingFromJevAnswer(undefined)).toBe("UNSURE");
    expect(endingFromJevAnswer({ type: "choice", choice: "XYZ", confidence: 1 })).toBe("UNSURE");
  });
});

describe("autoCloseHint", () => {
  const now = br("2026-10-09T15:00:00");
  it("clínica falou por último há 3h úteis: fecha em ~1h", () => {
    expect(autoCloseHint({ lastDirection: "OUTBOUND", lastAt: br("2026-10-09T12:00:00"), pinned: false, now })).toBe("fecha em ~1h");
  });
  it("já passou do prazo: fecha na próxima rodada", () => {
    expect(autoCloseHint({ lastDirection: "OUTBOUND", lastAt: br("2026-10-09T10:00:00"), pinned: false, now })).toBe("fecha em instantes");
  });
  it("ainda longe, paciente falou por último ou fixada: sem aviso", () => {
    expect(autoCloseHint({ lastDirection: "OUTBOUND", lastAt: br("2026-10-09T14:00:00"), pinned: false, now })).toBeNull();
    expect(autoCloseHint({ lastDirection: "INBOUND", lastAt: br("2026-10-09T10:00:00"), pinned: false, now })).toBeNull();
    expect(autoCloseHint({ lastDirection: "OUTBOUND", lastAt: br("2026-10-09T10:00:00"), pinned: true, now })).toBeNull();
  });
});

describe("desfechos novos (07/11: Urolaser ~50% inatividade)", () => {
  it("informação entregue fecha como dúvida esclarecida, sem aviso", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 4, ending: "INFO_GIVEN" })).toBe("close_info");
    expect(endingFromJevAnswer({ type: "choice", choice: "INFO_GIVEN", confidence: 0.9 })).toBe("INFO_GIVEN");
  });
  it("agendado pela recepção fecha como agendamento concluído", () => {
    expect(decideAutoClose({ ...base, idleBusinessHours: 25, ending: "SCHEDULED" })).toBe("close_scheduled");
  });
  it("detecta 'Agendado/Agendada' da recepção nas últimas mensagens", () => {
    const m = (direction: "INBOUND" | "OUTBOUND", content: string) => ({ direction, content });
    expect(hasSchedulingMessage([m("OUTBOUND", "Agendada CONSULTA com Dr (a) ALAN para o dia 10/11"), m("INBOUND", "obg")])).toBe(true);
    expect(hasSchedulingMessage([m("OUTBOUND", "Agendado 25-09 às 08:00h ordem de chegada")])).toBe(true);
    expect(hasSchedulingMessage([m("OUTBOUND", "*Agendado* para terça")])).toBe(true);
    expect(hasSchedulingMessage([m("INBOUND", "Agendado já?")])).toBe(false);
    expect(hasSchedulingMessage([m("OUTBOUND", "Você já tem exame agendado?")])).toBe(false);
    expect(hasSchedulingMessage([m("OUTBOUND", null as unknown as string)])).toBe(false);
  });
});
