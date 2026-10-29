import { describe, it, expect } from "vitest";
import { computeFunnel, computeWeeklyTrend, computeNewVsReturning, computeAgendaRisk, buildInsightFacts } from "./report-insights";

describe("computeFunnel", () => {
  const base = { total: 200, answered: 180, withOutcome: 120, scheduled: 60, lost: 40, noOutcome: 80, ticket: 150 };

  it("monta as etapas com % sobre o total", () => {
    const f = computeFunnel(base);
    expect(f.steps.map((s) => [s.key, s.count, s.pctOfTotal])).toEqual([
      ["conversas", 200, 100],
      ["atendidas", 180, 90],
      ["com_desfecho", 120, 60],
      ["agendaram", 60, 30],
    ]);
  });

  it("aponta a etapa com a maior perda", () => {
    expect(computeFunnel(base).biggestDrop).toEqual({ from: "atendidas", to: "com_desfecho", lost: 60 });
  });

  it("oportunidade = perdidos + sem retorno, com valor pelo ticket médio", () => {
    expect(computeFunnel(base).opportunity).toEqual({ patients: 120, value: 18000 });
  });

  it("sem ticket, valor null; total zero não divide por zero", () => {
    expect(computeFunnel({ ...base, ticket: null }).opportunity.value).toBeNull();
    const empty = computeFunnel({ total: 0, answered: 0, withOutcome: 0, scheduled: 0, lost: 0, noOutcome: 0, ticket: null });
    expect(empty.steps.every((s) => s.pctOfTotal === 0)).toBe(true);
    expect(empty.biggestDrop).toBeNull();
  });
});

describe("computeWeeklyTrend", () => {
  // Semana começa na segunda, no horário de Brasília.
  it("agrupa por semana (seg–dom, Brasília) com conversão", () => {
    const rows = [
      { createdAt: new Date("2026-10-05T13:00:00Z"), scheduled: true }, // seg 05/10
      { createdAt: new Date("2026-10-11T23:00:00Z"), scheduled: false }, // dom 11/10 20h BRT
      { createdAt: new Date("2026-10-12T02:00:00Z"), scheduled: false }, // dom 11/10 23h BRT
      { createdAt: new Date("2026-10-12T12:00:00Z"), scheduled: true }, // seg 12/10
    ];
    const weeks = computeWeeklyTrend(rows, new Date("2026-10-05T03:00:00Z"), new Date("2026-10-19T03:00:00Z"));
    expect(weeks).toEqual([
      { label: "05/10", conversations: 3, scheduled: 1, rate: 33.3 },
      { label: "12/10", conversations: 1, scheduled: 1, rate: 100 },
    ]);
  });

  it("inclui semanas vazias dentro do período (rate null)", () => {
    const weeks = computeWeeklyTrend([], new Date("2026-10-05T03:00:00Z"), new Date("2026-10-12T03:00:00Z"));
    expect(weeks).toEqual([{ label: "05/10", conversations: 0, scheduled: 0, rate: null }]);
  });
});

describe("computeNewVsReturning", () => {
  it("novo = 1ª conversa do contato com a clínica dentro do período", () => {
    const since = new Date("2026-10-01T03:00:00Z");
    const r = computeNewVsReturning(
      [
        { contactId: "a", firstConversationAt: new Date("2026-10-10T12:00:00Z") },
        { contactId: "b", firstConversationAt: new Date("2026-08-10T12:00:00Z") },
        { contactId: "c", firstConversationAt: new Date("2026-10-02T12:00:00Z") },
        { contactId: "c", firstConversationAt: new Date("2026-10-02T12:00:00Z") },
      ],
      since
    );
    expect(r).toEqual({ newPatients: 2, returning: 1, newPct: 66.7 });
  });

  it("contato com várias conversas vale pela mais antiga", () => {
    const since = new Date("2026-10-01T03:00:00Z");
    const r = computeNewVsReturning(
      [
        { contactId: "a", firstConversationAt: new Date("2026-07-01T12:00:00Z") },
        { contactId: "a", firstConversationAt: new Date("2026-10-10T12:00:00Z") },
      ],
      since
    );
    expect(r).toEqual({ newPatients: 0, returning: 1, newPct: 0 });
  });
});

describe("computeAgendaRisk", () => {
  const items = [
    { numero: 1, medico: "DR A", date: "2026-10-05", hora: "08:00" }, // segunda
    { numero: 2, medico: "DR A", date: "2026-10-05", hora: "09:00" },
    { numero: 3, medico: "DR B", date: "2026-10-06", hora: "08:00" }, // terça
    { numero: 4, medico: "DR B", date: "2026-10-06", hora: "14:00" },
  ];
  const responses = new Map<number, string | null>([
    [1, "CONFIRMED"],
    [2, null],
    [3, "CANCELLED"],
  ]);

  it("por médico: confirmados, cancelados, sem resposta e risco (cancelou + sem resposta sobre lembrados)", () => {
    const r = computeAgendaRisk(items, responses);
    expect(r.byDoctor).toEqual([
      { key: "DR A", total: 2, reminded: 2, confirmed: 1, cancelled: 0, noReply: 1, riskPct: 50 },
      { key: "DR B", total: 2, reminded: 1, confirmed: 0, cancelled: 1, noReply: 0, riskPct: 100 },
    ]);
  });

  it("por dia da semana, na ordem seg→sáb", () => {
    const r = computeAgendaRisk(items, responses);
    expect(r.byWeekday.map((w) => [w.key, w.total])).toEqual([
      ["Segunda", 2],
      ["Terça", 2],
    ]);
  });

  it("total geral", () => {
    expect(computeAgendaRisk(items, responses).overall).toEqual({ key: "Total", total: 4, reminded: 3, confirmed: 1, cancelled: 1, noReply: 1, riskPct: 66.7 });
  });
});

describe("buildInsightFacts", () => {
  it("gera frases objetivas com as variações relevantes", () => {
    const facts = buildInsightFacts({
      conversionRate: { current: 42, previous: 50 },
      medianFirstReplyMin: { current: 30, previous: 12 },
      conversations: { current: 220, previous: 200 },
      topLostReason: { label: "Preço", count: 12 },
      biggestDrop: { from: "atendidas", to: "com_desfecho", lost: 60 },
      riskiestWeekday: { key: "Segunda", riskPct: 45 },
      opportunity: { patients: 120, value: 18000 },
    });
    expect(facts).toEqual([
      "Conversão caiu de 50% para 42% (−8 pts).",
      "Tempo até a 1ª resposta subiu de 12 min para 30 min.",
      "Conversas subiram 10% (200 → 220).",
      "Principal motivo de perda: Preço (12).",
      "Maior perda no funil: de atendidas para com desfecho (60 pacientes).",
      "Dia com menos confirmação: Segunda (45% cancelaram ou não responderam ao lembrete).",
      "Oportunidade: 120 pacientes sem agendamento, cerca de R$ 18.000.",
    ]);
  });

  it("ignora variações pequenas e dados ausentes", () => {
    expect(
      buildInsightFacts({
        conversionRate: { current: 50, previous: 49 },
        medianFirstReplyMin: { current: null, previous: 10 },
        conversations: { current: 101, previous: 100 },
      })
    ).toEqual([]);
  });
});
