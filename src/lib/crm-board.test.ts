import { describe, expect, it } from "vitest";
import { columnValue, crmAlert, kanbanStageOf, matchesQuickFilter, sortColumn, type CrmCardInput } from "./crm-board";

const now = new Date("2026-10-15T15:00:00-03:00");
const card = (over: Partial<CrmCardInput>): CrmCardInput => ({
  isResolved: false,
  funnelStage: "triagem",
  waitingMinutes: null,
  lastMessageAt: "2026-10-15T10:00:00-03:00",
  tags: [],
  estimatedValueNumber: undefined,
  ...over,
});

describe("kanbanStageOf", () => {
  it("finalizada vai pra Finalizado mesmo com motivo (bug: comparava o texto do selo)", () => {
    expect(kanbanStageOf(card({ isResolved: true, funnelStage: "agendado" }))).toBe("finalizado");
    expect(kanbanStageOf(card({ funnelStage: "orcamento" }))).toBe("orcamento");
  });
});

describe("matchesQuickFilter", () => {
  it("ativos = não finalizados", () => {
    expect(matchesQuickFilter(card({}), "ativos", now)).toBe(true);
    expect(matchesQuickFilter(card({ isResolved: true }), "ativos", now)).toBe(false);
  });
  it("aguardando = paciente esperando há mais de 15 min", () => {
    expect(matchesQuickFilter(card({ waitingMinutes: 16 }), "aguardando", now)).toBe(true);
    expect(matchesQuickFilter(card({ waitingMinutes: 10 }), "aguardando", now)).toBe(false);
    expect(matchesQuickFilter(card({ waitingMinutes: null }), "aguardando", now)).toBe(false);
  });
  it("frios = ativos sem conversa há mais de 30 dias", () => {
    expect(matchesQuickFilter(card({ lastMessageAt: "2026-09-10T10:00:00-03:00" }), "frios", now)).toBe(true);
    expect(matchesQuickFilter(card({ lastMessageAt: "2026-10-01T10:00:00-03:00" }), "frios", now)).toBe(false);
    expect(matchesQuickFilter(card({ isResolved: true, lastMessageAt: "2026-09-10T10:00:00-03:00" }), "frios", now)).toBe(false);
  });
});

describe("crmAlert", () => {
  it("tag 'Sem retorno' vence; depois 'sem interação hoje' (só ativos)", () => {
    expect(crmAlert(card({ tags: ["⏳ Sem retorno do paciente"] }), now)).toBe("sem_retorno");
    expect(crmAlert(card({ lastMessageAt: "2026-10-14T18:00:00-03:00" }), now)).toBe("sem_interacao_hoje");
    expect(crmAlert(card({}), now)).toBeNull();
    expect(crmAlert(card({ isResolved: true, lastMessageAt: "2026-10-01T10:00:00-03:00" }), now)).toBeNull();
  });
});

describe("columnValue", () => {
  it("soma o estimado de cada card; sem estimado usa o ticket médio", () => {
    expect(columnValue([card({ estimatedValueNumber: 500 }), card({}), card({ estimatedValueNumber: 300 })], 200)).toEqual({ total: 1000, fromTicket: 1 });
    expect(columnValue([card({}), card({})], null)).toEqual({ total: 0, fromTicket: 0 });
  });
});

describe("sortColumn", () => {
  it("quem espera há mais tempo primeiro; depois conversa mais recente", () => {
    const a = card({ waitingMinutes: 5, lastMessageAt: "2026-10-15T14:00:00-03:00" });
    const b = card({ waitingMinutes: 90 });
    const c = card({ lastMessageAt: "2026-10-15T12:00:00-03:00" });
    const d = card({ lastMessageAt: "2026-10-15T09:00:00-03:00" });
    expect(sortColumn([d, a, c, b])).toEqual([b, a, c, d]);
  });
});
