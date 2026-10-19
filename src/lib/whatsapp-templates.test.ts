import { describe, it, expect } from "vitest";
import { buildAppointmentMessage, type AppointmentNotificationData } from "./whatsapp-templates";

const data: AppointmentNotificationData = {
  id: "apt1",
  patientName: "Maria da Silva",
  patientPhone: "5577999990000",
  date: new Date("2026-10-20T00:00:00Z"),
  timeSlot: "14:30",
  notes: null,
  clinic: { tradeName: "Urolaser", address: "Rua A, 10", neighborhood: "Centro", city: "Vitória da Conquista" },
  procedure: { name: "Consulta", preparationInstructions: null },
};

describe("buildAppointmentMessage — reengajamento", () => {
  it("cancelamento chama o paciente pelo nome e convida a remarcar respondendo no próprio WhatsApp", () => {
    const text = buildAppointmentMessage("CANCELLED", data)!;
    expect(text).toContain("cancelado");
    expect(text).toContain("Maria");
    expect(text).toMatch(/responda esta mensagem/i);
    expect(text).toMatch(/novo hor[aá]rio/i);
  });

  it("falta convida a remarcar respondendo no próprio WhatsApp", () => {
    const text = buildAppointmentMessage("NO_SHOW", data)!;
    expect(text).toContain("Não identificamos seu comparecimento");
    expect(text).toMatch(/responda esta mensagem/i);
    expect(text).toMatch(/novo hor[aá]rio/i);
  });

  it("não manda mais o paciente 'fazer nova busca na plataforma'", () => {
    expect(buildAppointmentMessage("CANCELLED", data)).not.toMatch(/nova busca/i);
  });

  it("mantém o resumo do agendamento nas duas mensagens", () => {
    for (const status of ["CANCELLED", "NO_SHOW"] as const) {
      const text = buildAppointmentMessage(status, data)!;
      expect(text).toContain("Consulta");
      expect(text).toContain("Urolaser");
      expect(text).toContain("14:30");
    }
  });

  it("confirmado e concluído continuam sem convite de remarcação", () => {
    expect(buildAppointmentMessage("COMPLETED", data)).not.toMatch(/novo hor[aá]rio/i);
    expect(buildAppointmentMessage("CONFIRMED", data)).not.toMatch(/novo hor[aá]rio/i);
  });
});
