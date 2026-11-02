import { describe, expect, it } from "vitest";
import {
  arrivalQueue,
  matchesPatientQuery,
  overdueMinutes,
  systemPendings,
  agendaDoctors,
  daySummary,
  visibleRowRange,
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

describe("daySummary", () => {
  it("conta por grupo; 'Quer remarcar' separado de aguardando", () => {
    const s = daySummary([
      item({ status: "CONFIRMED" }),
      item({ status: "SENT" }),
      item({ status: "PENDING" }),
      item({ status: "RESCHEDULE" }),
      item({ status: "IN_SERVICE" }),
      item({ status: "NO_SHOW" }),
      item({ status: "CANCELLED" }),
    ]);
    expect(s).toEqual({ total: 7, confirmado: 1, aguardando: 2, remarcar: 1, presente: 1, atendido: 0, falta: 2 });
  });
});

describe("visibleRowRange", () => {
  it("do primeiro ao último paciente, com folga de 1 linha", () => {
    expect(visibleRowRange([item({ time: "08:30" }), item({ time: "10:00" })])).toEqual([5, 13]); // 08:15 .. 10:15
  });
  it("inclui a hora atual quando é hoje", () => {
    expect(visibleRowRange([item({ time: "08:30" })], "11:05")).toEqual([5, 17]);
  });
  it("sem pacientes: horário comercial 08–18h", () => {
    expect(visibleRowRange([])).toEqual([4, 43]);
  });
});

describe("arrivalQueue", () => {
  const qi = (key: string, status: AgendaItem["status"], arrivedAt?: string, doctor = "Dr. A"): AgendaItem => ({
    key, source: "BRIDGE", externalId: key, date: "2026-10-21", time: "09:00", patientName: key, phone: null,
    procedure: null, doctor, status, bridgeNumero: null, arrivedAt,
  });
  const now = new Date("2026-10-21T13:00:00Z"); // 10:00 em Brasília
  it("só quem chegou (IN_SERVICE) hoje, por ordem de chegada, com minutos de espera", () => {
    const q = arrivalQueue(
      [
        qi("b", "IN_SERVICE", "2026-10-21T12:40:00Z"),
        qi("a", "IN_SERVICE", "2026-10-21T12:15:00Z"),
        qi("c", "CONFIRMED"),
        qi("d", "COMPLETED", "2026-10-21T12:00:00Z"),
      ],
      "2026-10-21",
      now
    );
    expect(q.map((x) => [x.item.key, x.position, x.waitingMin])).toEqual([
      ["a", 1, 45],
      ["b", 2, 20],
    ]);
  });
  it("atraso conta do horário marcado, não da chegada", () => {
    const early = { ...qi("a", "IN_SERVICE", "2026-10-21T11:30:00Z"), time: "10:30" }; // chegou 08:30, marcado 10:30
    const late = { ...qi("b", "IN_SERVICE", "2026-10-21T12:00:00Z"), time: "09:20" }; // marcado 09:20, agora 10:00
    const walkIn = { ...qi("c", "IN_SERVICE", "2026-10-21T12:00:00Z"), time: null };
    const q = arrivalQueue([early, late, walkIn], "2026-10-21", now);
    expect(q.map((x) => [x.item.key, x.waitingMin, x.lateMin])).toEqual([
      ["a", 90, 0],
      ["b", 60, 40],
      ["c", 60, null],
    ]);
  });
  it("médico com espaço sobrando conta na mesma fila", () => {
    const q = arrivalQueue(
      [qi("a", "IN_SERVICE", "2026-10-21T12:15:00Z", "Dr. A"), qi("b", "IN_SERVICE", "2026-10-21T12:20:00Z", "Dr. A ")],
      "2026-10-21",
      now
    );
    expect(q.map((x) => x.position)).toEqual([1, 2]);
  });
  it("agrupa por médico (posições não se repetem misturadas)", () => {
    const q = arrivalQueue(
      [
        qi("a1", "IN_SERVICE", "2026-10-21T12:10:00Z", "Dr. A"),
        qi("b1", "IN_SERVICE", "2026-10-21T12:15:00Z", "Dr. B"),
        qi("a2", "IN_SERVICE", "2026-10-21T12:20:00Z", "Dr. A"),
      ],
      "2026-10-21",
      now
    );
    expect(q.map((x) => [x.item.key, x.position])).toEqual([["a1", 1], ["a2", 2], ["b1", 1]]);
  });
  it("posição conta por médico", () => {
    const q = arrivalQueue(
      [qi("a", "IN_SERVICE", "2026-10-21T12:15:00Z", "Dr. A"), qi("b", "IN_SERVICE", "2026-10-21T12:20:00Z", "Dr. B")],
      "2026-10-21",
      now
    );
    expect(q.map((x) => x.position)).toEqual([1, 1]);
  });
});

describe("systemPendings", () => {
  it("lista só marcações do sistema canceladas à mão, de hoje em diante", () => {
    const list = systemPendings(
      [
        item({ key: "a", source: "BRIDGE", status: "CANCELLED", isManual: true, date: "2026-11-02" }),
        item({ key: "b", source: "BRIDGE", status: "CANCELLED", isManual: true, date: "2026-11-01" }),
        item({ key: "c", source: "LOCAL", status: "CANCELLED", isManual: true, date: "2026-11-03" }),
        item({ key: "d", source: "BRIDGE", status: "NO_SHOW", isManual: true, date: "2026-11-03" }),
        item({ key: "e", source: "BRIDGE", status: "CONFIRMED", isManual: true, date: "2026-11-03" }),
      ],
      "2026-11-02"
    );
    expect(list.map((i) => i.key)).toEqual(["a"]);
  });
  it("falta do sistema marcada no Conecta (até 7 dias atrás) também é pendência", () => {
    const list = systemPendings(
      [
        item({ key: "f1", source: "BRIDGE", status: "NO_SHOW", isManual: true, date: "2026-10-30" }),
        item({ key: "f2", source: "BRIDGE", status: "NO_SHOW", isManual: true, date: "2026-10-20" }),
        item({ key: "f3", source: "LOCAL", status: "NO_SHOW", isManual: true, date: "2026-11-02" }),
      ],
      "2026-11-02"
    );
    expect(list.map((i) => i.key)).toEqual(["f1"]);
  });
});

describe("matchesPatientQuery", () => {
  it("acha por nome sem acento e por pedaço do telefone", () => {
    const p = item({ patientName: "MARIA JOSÉ", phone: "5577999701234" });
    expect(matchesPatientQuery(p, "jose")).toBe(true);
    expect(matchesPatientQuery(p, "9970-1234")).toBe(true);
    expect(matchesPatientQuery(p, "joao")).toBe(false);
    expect(matchesPatientQuery(p, "  ")).toBe(true);
  });
});

describe("overdueMinutes", () => {
  const base = { date: "2026-11-02", time: "08:15", status: "CONFIRMED" as const };
  it("aguardando com horário passado há mais de 15 min = atrasado", () => {
    expect(overdueMinutes(item(base), "2026-11-02", "08:40")).toBe(25);
  });
  it("dentro da tolerância, futuro, outro dia ou já chegou = null", () => {
    expect(overdueMinutes(item(base), "2026-11-02", "08:25")).toBeNull();
    expect(overdueMinutes(item({ ...base, time: "10:00" }), "2026-11-02", "08:40")).toBeNull();
    expect(overdueMinutes(item({ ...base, date: "2026-11-01" }), "2026-11-02", "08:40")).toBeNull();
    expect(overdueMinutes(item({ ...base, status: "IN_SERVICE" }), "2026-11-02", "08:40")).toBeNull();
    expect(overdueMinutes(item({ ...base, time: null }), "2026-11-02", "08:40")).toBeNull();
  });
});
