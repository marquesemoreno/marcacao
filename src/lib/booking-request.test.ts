import { describe, expect, it } from "vitest";
import { parseBookingExtraction, bookingRequestAction, bookingSummary } from "./booking-request";

describe("parseBookingExtraction", () => {
  it("normaliza campos e corta textos longos", () => {
    expect(
      parseBookingExtraction({ querAgendar: true, nome: "  Maria  ", medico: "Dr. João", procedimento: "consulta", periodo: "manha", datas: "semana que vem", obs: "x".repeat(400) }),
    ).toEqual({ patientName: "Maria", doctorName: "Dr. João", procedure: "consulta", period: "MORNING", preferredDates: "semana que vem", notes: "x".repeat(300) });
  });
  it("período desconhecido → ANY; vazios → null", () => {
    expect(parseBookingExtraction({ querAgendar: true, periodo: "qualquer", medico: "", nome: null })).toMatchObject({ period: "ANY", doctorName: null, patientName: null });
    expect(parseBookingExtraction({ querAgendar: true, periodo: "tarde" })?.period).toBe("AFTERNOON");
  });
  it("não quer agendar ou lixo → null", () => {
    expect(parseBookingExtraction({ querAgendar: false })).toBeNull();
    expect(parseBookingExtraction("oi")).toBeNull();
    expect(parseBookingExtraction(null)).toBeNull();
  });
});

describe("bookingRequestAction", () => {
  const now = new Date("2026-11-02T12:00:00Z");
  it("sem pedido aberto → cria", () => {
    expect(bookingRequestAction(null, now)).toBe("CREATE");
  });
  it("pedido aberto recente → atualiza (não duplica)", () => {
    expect(bookingRequestAction({ status: "OPEN", createdAt: new Date("2026-10-30T12:00:00Z") }, now)).toBe("UPDATE");
  });
  it("pedido aberto com mais de 7 dias ou já resolvido → cria outro", () => {
    expect(bookingRequestAction({ status: "OPEN", createdAt: new Date("2026-10-20T12:00:00Z") }, now)).toBe("CREATE");
    expect(bookingRequestAction({ status: "SCHEDULED", createdAt: new Date("2026-11-01T12:00:00Z") }, now)).toBe("CREATE");
  });
});

describe("bookingSummary", () => {
  it("monta a linha do que o paciente quer", () => {
    expect(bookingSummary({ doctorName: "Dr. João", procedure: "Consulta", period: "MORNING", preferredDates: "terça" })).toBe("Consulta · Dr. João · manhã · terça");
    expect(bookingSummary({ doctorName: null, procedure: null, period: "ANY", preferredDates: null })).toBe("Quer agendar (sem detalhes ainda)");
  });
});
