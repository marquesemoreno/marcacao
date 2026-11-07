import { describe, expect, it } from "vitest";
import { doctorLossRates, forecastWeek, MIN_SAMPLE } from "./week-forecast";

const appt = (numero: number, medico: string | null) => ({ numero, medico });

describe("taxa de perda por médico (lembretes das últimas semanas)", () => {
  it("cancelou/remarcou/sem resposta conta como perda; confirmou não", () => {
    const past = [appt(1, "Dr A"), appt(2, "Dr A"), appt(3, "Dr A"), appt(4, "Dr A"), appt(5, "Dr B")];
    const logs = [
      { bridgeNumero: 1, response: "CONFIRMED" },
      { bridgeNumero: 2, response: "CANCELLED" },
      { bridgeNumero: 3, response: "RESCHEDULE" },
      { bridgeNumero: 4, response: null },
      { bridgeNumero: 5, response: "CONFIRMED" },
    ];
    const r = doctorLossRates(past, logs);
    expect(r.byDoctor.get("Dr A")).toEqual({ sample: 4, cancelled: 2, noReply: 1 });
    expect(r.clinic).toEqual({ sample: 5, cancelled: 2, noReply: 1 });
  });

  it("agendamento sem lembrete enviado fica fora da amostra", () => {
    const r = doctorLossRates([appt(1, "Dr A")], []);
    expect(r.clinic.sample).toBe(0);
  });
});

describe("previsão da semana", () => {
  const rates = {
    byDoctor: new Map([
      ["Dr A", { sample: MIN_SAMPLE, cancelled: MIN_SAMPLE / 2, noReply: 0 }],
      ["Dr B", { sample: 2, cancelled: 2, noReply: 0 }],
    ]),
    clinic: { sample: 100, cancelled: 10, noReply: 20 },
  };

  it("usa a taxa do médico com amostra suficiente, senão a da clínica", () => {
    const f = forecastWeek(
      [
        { date: "2026-11-09", appointments: [appt(10, "Dr A"), appt(11, "Dr A"), appt(12, "Dr B")] },
        { date: "2026-11-10", appointments: [] },
      ],
      rates
    );
    // Dr A: 50% cancela; Dr B (amostra pequena) usa a clínica: 10% cancela, 20% sem resposta.
    expect(f.days).toEqual([
      { date: "2026-11-09", total: 3, expectedCancel: 1.1, expectedNoReply: 0.2 },
      { date: "2026-11-10", total: 0, expectedCancel: 0, expectedNoReply: 0 },
    ]);
    expect(f.doctors[0]).toMatchObject({ doctor: "Dr A", total: 2, cancelRate: 50, fromClinicRate: false });
    expect(f.doctors[1]).toMatchObject({ doctor: "Dr B", total: 1, cancelRate: 10, noReplyRate: 20, fromClinicRate: true });
    expect(f.total).toBe(3);
  });

  it("sem histórico nenhum, não inventa taxa", () => {
    const f = forecastWeek([{ date: "d", appointments: [appt(1, null)] }], { byDoctor: new Map(), clinic: { sample: 0, cancelled: 0, noReply: 0 } });
    expect(f.days[0]).toEqual({ date: "d", total: 1, expectedCancel: null, expectedNoReply: null });
    expect(f.doctors[0]).toMatchObject({ doctor: "Sem médico", cancelRate: null });
  });
});
