import { describe, expect, it } from "vitest";
import { budgetFollowupDue, budgetFollowupMessage, BUDGET_FOLLOWUP_DAYS } from "./budget-followup";

const day = 86_400_000;
const sent = new Date("2026-11-01T13:00:00Z"); // 10h em Brasília
const at = (days: number) => new Date(sent.getTime() + days * day);

describe("budgetFollowupDue", () => {
  it("usa 3, 7 e 15 dias", () => {
    expect(BUDGET_FOLLOWUP_DAYS).toEqual([3, 7, 15]);
  });

  it("nada antes do 3º dia", () => {
    expect(budgetFollowupDue({ sentAt: sent, done: 0, now: at(2) })).toBeNull();
  });

  it("1ª cobrança a partir do 3º dia", () => {
    expect(budgetFollowupDue({ sentAt: sent, done: 0, now: at(3) })).toEqual({ step: 1, daysSince: 3 });
  });

  it("conta dias de calendário de Brasília, não 24h corridas", () => {
    // enviado 01/11 às 22h (Brasília) = 02/11 01:00Z; 04/11 08h Brasília já é o 3º dia
    const late = new Date("2026-11-02T01:00:00Z");
    expect(budgetFollowupDue({ sentAt: late, done: 0, now: new Date("2026-11-04T11:00:00Z") })).toEqual({
      step: 1,
      daysSince: 3,
    });
  });

  it("depois da 1ª feita, espera o 7º dia", () => {
    expect(budgetFollowupDue({ sentAt: sent, done: 1, now: at(5) })).toBeNull();
    expect(budgetFollowupDue({ sentAt: sent, done: 1, now: at(7) })).toEqual({ step: 2, daysSince: 7 });
  });

  it("cobrança atrasada não pula etapa: no 10º dia sem nenhuma feita, é a 1ª", () => {
    expect(budgetFollowupDue({ sentAt: sent, done: 0, now: at(10) })).toEqual({ step: 1, daysSince: 10 });
  });

  it("3ª no 15º dia e depois acabou", () => {
    expect(budgetFollowupDue({ sentAt: sent, done: 2, now: at(15) })).toEqual({ step: 3, daysSince: 15 });
    expect(budgetFollowupDue({ sentAt: sent, done: 3, now: at(40) })).toBeNull();
  });

  it("não cobra de novo no mesmo dia da última cobrança", () => {
    expect(
      budgetFollowupDue({ sentAt: sent, done: 1, lastFollowupAt: at(7), now: at(7) }),
    ).toBeNull();
  });
});

describe("budgetFollowupMessage", () => {
  it("usa o primeiro nome e muda o texto por etapa", () => {
    const m1 = budgetFollowupMessage(1, "maria aparecida souza");
    const m3 = budgetFollowupMessage(3, "maria aparecida souza");
    expect(m1).toMatch(/^Oi, Maria!/);
    expect(m1).not.toEqual(m3);
  });

  it("sem nome, cumprimenta sem nome", () => {
    expect(budgetFollowupMessage(2, "")).toMatch(/^Oi! /);
  });
});
