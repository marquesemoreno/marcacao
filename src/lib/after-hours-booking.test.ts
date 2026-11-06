import { describe, expect, it } from "vitest";
import {
  afterHoursBookingReply,
  isClinicOpenAt,
  missingBookingField,
  nextOpening,
  AFTER_HOURS_MAX_REPLIES,
} from "./after-hours-booking";

const hours = {
  seg: { open: "08:00", close: "18:00" },
  ter: { open: "08:00", close: "18:00" },
  qua: { open: "08:00", close: "18:00" },
  qui: { open: "08:00", close: "18:00" },
  sex: { open: "08:00", close: "18:00" },
  sab: { open: "08:00", close: "12:00" },
  dom: { closed: true },
};
// Horário de Brasília = UTC-3
const br = (iso: string) => new Date(`${iso}-03:00`);

describe("isClinicOpenAt", () => {
  it("usa o horário de Brasília, não o do servidor", () => {
    expect(isClinicOpenAt(hours, br("2026-11-05T09:00:00"))).toBe(true); // quinta 9h
    expect(isClinicOpenAt(hours, br("2026-11-05T19:30:00"))).toBe(false); // quinta 19h30
    expect(isClinicOpenAt(hours, br("2026-11-05T07:59:00"))).toBe(false);
  });
  it("domingo fechado e sábado só de manhã", () => {
    expect(isClinicOpenAt(hours, br("2026-11-08T10:00:00"))).toBe(false);
    expect(isClinicOpenAt(hours, br("2026-11-07T11:00:00"))).toBe(true);
    expect(isClinicOpenAt(hours, br("2026-11-07T13:00:00"))).toBe(false);
  });
  it("feriado nacional fecha", () => {
    expect(isClinicOpenAt(hours, br("2026-11-20T10:00:00"))).toBe(false); // Consciência Negra
  });
  it("sem expediente cadastrado usa o padrão 8–18", () => {
    expect(isClinicOpenAt(null, br("2026-11-05T10:00:00"))).toBe(true);
  });
});

describe("nextOpening", () => {
  it("à noite: amanhã", () => {
    expect(nextOpening(hours, br("2026-11-05T21:00:00"))).toBe("amanhã a partir das 08:00");
  });
  it("de madrugada: hoje", () => {
    expect(nextOpening(hours, br("2026-11-06T05:00:00"))).toBe("hoje a partir das 08:00");
  });
  it("sábado à tarde: segunda", () => {
    expect(nextOpening(hours, br("2026-11-07T15:00:00"))).toBe("segunda-feira a partir das 08:00");
  });
  it("pula feriado", () => {
    // quinta 19/11 à noite, sexta 20/11 é feriado -> sábado
    expect(nextOpening(hours, br("2026-11-19T20:00:00"))).toBe("sábado a partir das 08:00");
  });
});

describe("missingBookingField", () => {
  const full = { procedure: "Consulta", doctorName: null, period: "MORNING", preferredDates: null };
  it("pede o que primeiro (procedimento ou médico)", () => {
    expect(missingBookingField({ ...full, procedure: null })).toBe("O_QUE");
  });
  it("depois pede quando (período ou datas)", () => {
    expect(missingBookingField({ ...full, period: "ANY" })).toBe("QUANDO");
  });
  it("médico sem procedimento já basta para o 'o que'", () => {
    expect(missingBookingField({ ...full, procedure: null, doctorName: "Dr. Ricardo" })).toBeNull();
  });
  it("datas sem período já bastam para o 'quando'", () => {
    expect(missingBookingField({ ...full, period: "ANY", preferredDates: "semana que vem" })).toBeNull();
  });
});

describe("afterHoursBookingReply", () => {
  it("pergunta o que falta e nunca promete horário", () => {
    const r = afterHoursBookingReply({ missing: "O_QUE", name: "maria souza", opening: "amanhã a partir das 08:00" });
    expect(r).toMatch(/^Oi, Maria!/);
    expect(r).toMatch(/consulta ou exame/i);
  });
  it("completo: resume e diz quando a recepção confirma", () => {
    const r = afterHoursBookingReply({
      missing: null,
      name: "",
      opening: "amanhã a partir das 08:00",
      summary: "Consulta · manhã",
    });
    expect(r).toContain("Consulta · manhã");
    expect(r).toContain("amanhã a partir das 08:00");
    expect(r).toMatch(/confirma/i);
  });
  it("limite de respostas por noite", () => {
    expect(AFTER_HOURS_MAX_REPLIES).toBe(3);
  });
});
