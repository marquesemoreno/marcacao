import { describe, it, expect } from "vitest";
import { secondReminderDue, buildSecondReminderMessage } from "./second-reminder";
import { wasSentConfirmationPrompt, resolveStatusFromReply } from "./appointment-reply";

/** Hora de Brasília/Bahia (UTC-3) → Date. */
function br(iso: string, hhmm: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  const [h, min] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h + 3, min));
}

describe("secondReminderDue", () => {
  const base = {
    appointmentDateIso: "2026-11-20",
    appointmentTime: "14:00",
    hoursBefore: 3,
    d1Response: null,
    secondSentAt: null,
  };

  it("manda dentro das X horas antes da consulta, no mesmo dia", () => {
    expect(secondReminderDue({ ...base, now: br("2026-11-20", "11:00") })).toBe(true);
    expect(secondReminderDue({ ...base, now: br("2026-11-20", "13:30") })).toBe(true);
  });

  it("não manda antes da janela", () => {
    expect(secondReminderDue({ ...base, now: br("2026-11-20", "10:59") })).toBe(false);
  });

  it("não manda quando o horário já passou", () => {
    expect(secondReminderDue({ ...base, now: br("2026-11-20", "14:00") })).toBe(false);
    expect(secondReminderDue({ ...base, now: br("2026-11-20", "15:10") })).toBe(false);
  });

  it("não manda para quem já respondeu ao D-1 (confirmou, cancelou ou pediu remarcar)", () => {
    for (const d1Response of ["CONFIRMED", "CANCELLED", "RESCHEDULE"]) {
      expect(secondReminderDue({ ...base, d1Response, now: br("2026-11-20", "12:00") })).toBe(false);
    }
  });

  it("não manda duas vezes", () => {
    expect(
      secondReminderDue({ ...base, secondSentAt: br("2026-11-20", "11:05"), now: br("2026-11-20", "12:00") })
    ).toBe(false);
  });

  it("não manda antes das 07h, mesmo para consulta cedo", () => {
    const early = { ...base, appointmentTime: "08:00" };
    expect(secondReminderDue({ ...early, now: br("2026-11-20", "06:30") })).toBe(false);
    expect(secondReminderDue({ ...early, now: br("2026-11-20", "07:00") })).toBe(true);
  });

  it("não manda em outro dia, mesmo se a janela for grande", () => {
    const wide = { ...base, appointmentTime: "09:00", hoursBefore: 20 };
    expect(secondReminderDue({ ...wide, now: br("2026-11-19", "15:00") })).toBe(false);
  });

  it("desligado (null ou 0) ou sem horário na agenda → não manda", () => {
    const now = br("2026-11-20", "12:00");
    expect(secondReminderDue({ ...base, hoursBefore: null, now })).toBe(false);
    expect(secondReminderDue({ ...base, hoursBefore: 0, now })).toBe(false);
    expect(secondReminderDue({ ...base, appointmentTime: null, now })).toBe(false);
    expect(secondReminderDue({ ...base, appointmentTime: "a combinar", now })).toBe(false);
  });

  it("aceita horário com segundos vindo do Firebird", () => {
    expect(secondReminderDue({ ...base, appointmentTime: "14:00:00", now: br("2026-11-20", "12:00") })).toBe(true);
  });
});

describe("buildSecondReminderMessage", () => {
  const input = { patientName: "MARIA DA SILVA", clinicName: "Urolaser", time: "14:00" };

  it("é curto, com primeiro nome, hoje e horário", () => {
    const text = buildSecondReminderMessage(input);
    expect(text).toContain("Maria");
    expect(text).toContain("hoje às 14:00");
    expect(text).toContain("Urolaser");
  });

  it("não cita procedimento nem médico (dado de saúde mínimo)", () => {
    const text = buildSecondReminderMessage(input).toLowerCase();
    expect(text).not.toContain("dr");
    expect(text).not.toContain("exame");
    expect(text).not.toContain("consulta");
  });

  it("a resposta é reconhecida pelo mesmo fluxo de confirmação do D-1", () => {
    const text = buildSecondReminderMessage(input);
    expect(wasSentConfirmationPrompt(text)).toBe(true);
    expect(resolveStatusFromReply("1")).toBe("CONFIRMED");
  });

  it("para o responsável de menor, fala do paciente pelo nome", () => {
    const text = buildSecondReminderMessage({ ...input, patientName: "Pedro Lima", guardianFirstName: "Ana" });
    expect(text).toContain("Ana");
    expect(text).toContain("Pedro");
    expect(text).not.toContain("seu horário");
  });
});
