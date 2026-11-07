import { describe, expect, it } from "vitest";
import { buildBookingConfirmation } from "./booking-confirmation";

const base = {
  patientName: "MARIA DA SILVA",
  procedure: "CONSULTA EM CONSULTÓRIO (NO HORÁRIO NORMAL OU PREESTABELECIDO)",
  doctor: "ADEMIR ABREU MAGALHAES",
  date: "2026-11-13",
  time: "09:00",
  arrivalOrder: false,
  price: 250,
  clinicName: "Clínica Cirúrgica Santa Clara",
  address: "Av. Otávio Santos, 237 - Recreio, Vitória da Conquista",
  preparation: null as string | null,
};

describe("buildBookingConfirmation", () => {
  it("monta a confirmação completa com primeiro nome, dia da semana e valor", () => {
    const t = buildBookingConfirmation(base);
    expect(t).toContain("✅ Agendamento confirmado, Maria!");
    expect(t).toContain("🩺 Consulta em consultório (no horário normal ou preestabelecido)");
    expect(t).toContain("👨‍⚕️ Dr(a). Ademir Abreu Magalhaes");
    expect(t).toContain("📅 sexta-feira, 13/11/2026");
    expect(t).toContain("⏰ 09:00");
    expect(t).toContain("💲 R$ 250,00");
    expect(t).toContain("📍 Clínica Cirúrgica Santa Clara — Av. Otávio Santos, 237 - Recreio, Vitória da Conquista");
    expect(t).toContain("Se precisar remarcar, é só responder por aqui.");
  });

  it("ordem de chegada vira 'a partir de', sem hora vira só 'por ordem de chegada'", () => {
    expect(buildBookingConfirmation({ ...base, arrivalOrder: true })).toContain("⏰ A partir das 09:00, por ordem de chegada");
    expect(buildBookingConfirmation({ ...base, arrivalOrder: true, time: null })).toContain("⏰ Por ordem de chegada");
  });

  it("omite valor zerado, médico ausente ou que é nome de clínica, e endereço vazio", () => {
    const t = buildBookingConfirmation({ ...base, price: 0, doctor: "Clínica Conecta Saúde", address: "" });
    expect(t).not.toContain("💲");
    expect(t).not.toContain("👨‍⚕️");
    expect(t).toContain("📍 Clínica Cirúrgica Santa Clara");
    expect(buildBookingConfirmation({ ...base, doctor: null })).not.toContain("👨‍⚕️");
  });

  it("inclui o preparo quando existe", () => {
    expect(buildBookingConfirmation({ ...base, preparation: "Jejum de 8 horas." })).toContain("📋 Preparo: Jejum de 8 horas.");
  });

  it("nome que é número não entra na saudação", () => {
    expect(buildBookingConfirmation({ ...base, patientName: "5577999311841" })).toContain("✅ Agendamento confirmado!");
  });

  it("já com 'Dr' no nome não duplica o prefixo", () => {
    expect(buildBookingConfirmation({ ...base, doctor: "Dra. Paula Souza" })).toContain("👨‍⚕️ Dra. Paula Souza");
  });
});
