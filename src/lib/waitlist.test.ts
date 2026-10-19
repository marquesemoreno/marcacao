import { describe, it, expect } from "vitest";
import { normalizeWaitlistInput, openSlotFromStatus, rankWaitlistCandidates, buildSlotOfferMessage, type WaitlistEntryLike, type OpenSlot } from "./waitlist";

const now = { date: "2026-10-19", time: "10:00" };

describe("openSlotFromStatus", () => {
  const base = { status: "CANCELLED", date: "2026-10-20", time: "14:30", doctor: "Dra. Ana Souza", procedure: "Consulta" };

  it("cancelamento de data futura vira vaga", () => {
    expect(openSlotFromStatus(base, now)).toEqual({ date: "2026-10-20", time: "14:30", doctor: "Dra. Ana Souza", procedure: "Consulta" });
  });

  it("falta também libera a vaga, se o horário ainda não passou", () => {
    expect(openSlotFromStatus({ ...base, status: "NO_SHOW", date: "2026-10-19", time: "15:00" }, now)).not.toBeNull();
  });

  it("horário que já passou hoje, ou dia passado, não é vaga", () => {
    expect(openSlotFromStatus({ ...base, date: "2026-10-19", time: "09:00" }, now)).toBeNull();
    expect(openSlotFromStatus({ ...base, date: "2026-10-18" }, now)).toBeNull();
  });

  it("sem horário (ordem de chegada) não dá para oferecer", () => {
    expect(openSlotFromStatus({ ...base, time: null }, now)).toBeNull();
  });

  it("outros status não liberam vaga", () => {
    for (const status of ["PENDING", "SENT", "CONFIRMED", "RESCHEDULE", "IN_SERVICE", "COMPLETED"]) {
      expect(openSlotFromStatus({ ...base, status }, now)).toBeNull();
    }
  });
});

describe("rankWaitlistCandidates", () => {
  const slot: OpenSlot = { date: "2026-10-20", time: "14:30", doctor: "Dra. Ana Souza", procedure: "Consulta" };
  const entry = (over: Partial<WaitlistEntryLike> & { id: string }): WaitlistEntryLike => ({
    patientName: "Paciente",
    phone: "5577999990000",
    doctorName: null,
    period: "ANY",
    status: "WAITING",
    createdAt: new Date("2026-10-10T12:00:00Z"),
    ...over,
  });

  it("prefere quem pediu exatamente esse médico, depois quem aceita qualquer um", () => {
    const out = rankWaitlistCandidates(
      [entry({ id: "qualquer" }), entry({ id: "ana", doctorName: "ana souza" })],
      slot
    );
    expect(out.map((e) => e.id)).toEqual(["ana", "qualquer"]);
  });

  it("compara médico sem diferenciar caixa, acento nem 'Dr(a).'", () => {
    const out = rankWaitlistCandidates([entry({ id: "a", doctorName: "DRA ANA SOUZA" })], { ...slot, doctor: "Ana Souza" });
    expect(out.map((e) => e.id)).toEqual(["a"]);
  });

  it("tira quem quer outro médico", () => {
    const out = rankWaitlistCandidates([entry({ id: "outro", doctorName: "Dr. Pedro" })], slot);
    expect(out).toEqual([]);
  });

  it("respeita o período: tarde não serve para quem só pode de manhã", () => {
    const out = rankWaitlistCandidates([entry({ id: "manha", period: "MORNING" }), entry({ id: "tarde", period: "AFTERNOON" })], slot);
    expect(out.map((e) => e.id)).toEqual(["tarde"]);
  });

  it("entre iguais, quem espera há mais tempo vem primeiro", () => {
    const out = rankWaitlistCandidates(
      [entry({ id: "novo", createdAt: new Date("2026-10-15T12:00:00Z") }), entry({ id: "antigo", createdAt: new Date("2026-10-01T12:00:00Z") })],
      slot
    );
    expect(out.map((e) => e.id)).toEqual(["antigo", "novo"]);
  });

  it("só quem está aguardando; e nunca o próprio paciente que cancelou", () => {
    const out = rankWaitlistCandidates(
      [entry({ id: "ofertado", status: "OFFERED" }), entry({ id: "agendado", status: "BOOKED" }), entry({ id: "mesmo", phone: "5577988887777" }), entry({ id: "ok" })],
      slot,
      { exceptPhone: "(77) 98888-7777" }
    );
    expect(out.map((e) => e.id)).toEqual(["ok"]);
  });
});

describe("buildSlotOfferMessage", () => {
  it("convida pelo primeiro nome, cita dia, hora e médico, e pede resposta", () => {
    const text = buildSlotOfferMessage({ date: "2026-10-22", time: "14:30", doctor: "Dra. Ana Souza", procedure: "Consulta" }, "Maria da Silva", "Urolaser");
    expect(text).toContain("Maria");
    expect(text).not.toContain("da Silva");
    expect(text).toContain("quinta-feira");
    expect(text).toContain("22/10");
    expect(text).toContain("14:30");
    expect(text).toContain("Dra. Ana Souza");
    expect(text).toContain("Urolaser");
    expect(text).toMatch(/responda esta mensagem/i);
  });

  it("sem médico, não cita médico", () => {
    const text = buildSlotOfferMessage({ date: "2026-10-22", time: "08:00", doctor: null, procedure: null }, "João", "Urolaser");
    expect(text).not.toMatch(/null|undefined/);
    expect(text).toContain("08:00");
  });
});

describe("normalizeWaitlistInput", () => {
  it("apara os textos, guarda só dígitos no telefone e usa 'qualquer horário' por padrão", () => {
    const out = normalizeWaitlistInput({ patientName: "  Maria   da Silva ", phone: "(77) 99999-0000", doctorName: " Dra. Ana ", notes: "  prefere cedo " });
    expect(out).toEqual({ ok: true, value: { patientName: "Maria da Silva", phone: "77999990000", doctorName: "Dra. Ana", period: "ANY", notes: "prefere cedo" } });
  });

  it("médico e observação vazios viram null", () => {
    const out = normalizeWaitlistInput({ patientName: "João", phone: "77999990000", doctorName: "  ", notes: "" });
    expect(out).toMatchObject({ ok: true, value: { doctorName: null, notes: null } });
  });

  it("recusa nome vazio, telefone curto e período desconhecido", () => {
    expect(normalizeWaitlistInput({ patientName: " ", phone: "77999990000" })).toEqual({ ok: false, error: "Informe o nome do paciente." });
    expect(normalizeWaitlistInput({ patientName: "Ana", phone: "9999" })).toEqual({ ok: false, error: "Informe o WhatsApp com DDD." });
    expect(normalizeWaitlistInput({ patientName: "Ana", phone: "77999990000", period: "NOITE" })).toEqual({ ok: false, error: "Período inválido." });
  });
});
