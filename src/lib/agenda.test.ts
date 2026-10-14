import { describe, expect, it } from "vitest";
import {
  agendaDoctors,
  mergeAgenda,
  monthGridDays,
  resolveAgendaStatus,
  slotRowFor,
  weekDays,
  type AgendaItem,
} from "./agenda";

const item = (over: Partial<AgendaItem>): AgendaItem => ({
  key: "bridge:1",
  source: "BRIDGE",
  externalId: "1",
  date: "2026-10-14",
  time: "08:00",
  patientName: "Maria",
  phone: "77999998888",
  procedure: null,
  doctor: null,
  status: "PENDING",
  bridgeNumero: 1,
  ...over,
});

describe("resolveAgendaStatus", () => {
  it("marcação manual da recepção vence tudo", () => {
    expect(resolveAgendaStatus({ manual: "IN_SERVICE", reminderResponse: "CONFIRMED" })).toBe("IN_SERVICE");
  });
  it("resposta ao lembrete vira status", () => {
    expect(resolveAgendaStatus({ reminderResponse: "CONFIRMED" })).toBe("CONFIRMED");
    expect(resolveAgendaStatus({ reminderResponse: "CANCELLED" })).toBe("CANCELLED");
    expect(resolveAgendaStatus({ reminderResponse: "RESCHEDULE" })).toBe("RESCHEDULE");
  });
  it("lembrete enviado sem resposta = aguardando confirmação", () => {
    expect(resolveAgendaStatus({ reminderSent: true })).toBe("SENT");
  });
  it("agendamento do Conecta usa o status dele", () => {
    expect(resolveAgendaStatus({ local: "CONFIRMED" })).toBe("CONFIRMED");
    expect(resolveAgendaStatus({ local: "NO_SHOW" })).toBe("NO_SHOW");
    expect(resolveAgendaStatus({ local: "COMPLETED" })).toBe("COMPLETED");
  });
  it("sem nada = pendente", () => {
    expect(resolveAgendaStatus({})).toBe("PENDING");
  });
});

describe("mergeAgenda", () => {
  it("agendamento do Conecta que já está na ponte (mesmo NUMERO) não duplica", () => {
    const merged = mergeAgenda(
      [item({ bridgeNumero: 10, key: "bridge:10" })],
      [item({ source: "LOCAL", key: "local:a", bridgeNumero: 10 }), item({ source: "LOCAL", key: "local:b", bridgeNumero: null, time: "07:30" })]
    );
    expect(merged.map((m) => m.key)).toEqual(["local:b", "bridge:10"]);
  });
  it("ordena por data e hora, sem hora (ordem de chegada) por último", () => {
    const merged = mergeAgenda([item({ key: "a", time: "09:00" }), item({ key: "b", time: null }), item({ key: "c", time: "08:15" })], []);
    expect(merged.map((m) => m.key)).toEqual(["c", "a", "b"]);
  });
});

describe("slotRowFor", () => {
  it("linhas de 15 min a partir das 07:00", () => {
    expect(slotRowFor("07:00")).toBe(0);
    expect(slotRowFor("08:20")).toBe(5);
    expect(slotRowFor("18:45")).toBe(47);
  });
  it("fora da grade ou sem hora = null", () => {
    expect(slotRowFor("06:30")).toBeNull();
    expect(slotRowFor("19:00")).toBeNull();
    expect(slotRowFor(null)).toBeNull();
  });
});

describe("datas", () => {
  it("semana de segunda a sábado da data escolhida", () => {
    expect(weekDays("2026-10-14")).toEqual(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"]);
    expect(weekDays("2026-10-18")[0]).toBe("2026-10-12"); // domingo cai na semana anterior
  });
  it("grade do mês começa na segunda e cobre semanas inteiras", () => {
    const days = monthGridDays("2026-10-14");
    expect(days[0]).toBe("2026-09-28");
    expect(days.length % 7).toBe(0);
    expect(days).toContain("2026-10-31");
  });
});

describe("agendaDoctors", () => {
  it("médicos distintos em ordem alfabética, sem médico vira 'Sem médico'", () => {
    expect(agendaDoctors([item({ doctor: "Dr. Zé" }), item({ doctor: "Dra. Ana" }), item({ doctor: null }), item({ doctor: "Dr. Zé" })])).toEqual([
      "Dr. Zé",
      "Dra. Ana",
      "Sem médico",
    ].sort((a, b) => (a === "Sem médico" ? 1 : b === "Sem médico" ? -1 : a.localeCompare(b, "pt-BR"))));
  });
});
