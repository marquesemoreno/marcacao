import { describe, it, expect } from "vitest";
import { describeAiAction, filterAiActions, type AiActionRecord } from "./ai-actions";

const rec = (over: Partial<AiActionRecord> & { id: string }): AiActionRecord => ({
  kind: "APPT_CONFIRMED",
  summary: "pode ser sim",
  confidence: 0.93,
  conversationId: "c1",
  patientName: "Maria da Silva",
  createdAt: new Date("2026-10-19T12:00:00Z"),
  ...over,
});

describe("describeAiAction", () => {
  it("decisão sobre consulta: diz o que a IA fez e cita a mensagem do paciente", () => {
    expect(describeAiAction(rec({ id: "1", kind: "APPT_CONFIRMED" }))).toMatchObject({
      label: "Confirmou a consulta",
      group: "decisao",
      tone: "positive",
      detail: "“pode ser sim” · confiança 93%",
    });
    expect(describeAiAction(rec({ id: "2", kind: "APPT_CANCELLED", confidence: null })).label).toBe("Cancelou a consulta");
    expect(describeAiAction(rec({ id: "3", kind: "APPT_RESCHEDULE" })).label).toBe("Registrou pedido de remarcação");
  });

  it("decisão que cancela é destacada como atenção", () => {
    expect(describeAiAction(rec({ id: "x", kind: "APPT_CANCELLED" })).tone).toBe("attention");
  });

  it("atendimento: resposta enviada e escalonamento para humano", () => {
    expect(describeAiAction(rec({ id: "4", kind: "AI_REPLIED", confidence: null }))).toMatchObject({
      label: "Respondeu o paciente",
      group: "atendimento",
      detail: "“pode ser sim”",
    });
    expect(describeAiAction(rec({ id: "5", kind: "AI_ESCALATED", summary: "Falha ao gerar resposta da IA", confidence: null }))).toMatchObject({
      label: "Passou para a equipe",
      tone: "attention",
      detail: "Falha ao gerar resposta da IA",
    });
  });

  it("resumo longo é cortado", () => {
    const long = describeAiAction(rec({ id: "6", summary: "x".repeat(300) })).detail;
    expect(long.length).toBeLessThan(140);
    expect(long).toContain("…");
  });

  it("tipo desconhecido não quebra", () => {
    expect(describeAiAction(rec({ id: "7", kind: "NOVO" })).label).toBe("Ação da IA");
  });
});

describe("filterAiActions", () => {
  const list = [
    rec({ id: "a", kind: "APPT_CONFIRMED", patientName: "Maria da Silva", createdAt: new Date("2026-10-19T12:00:00Z") }),
    rec({ id: "b", kind: "AI_REPLIED", patientName: "João Pedro", createdAt: new Date("2026-10-10T12:00:00Z") }),
    rec({ id: "c", kind: "APPT_CANCELLED", patientName: "Ana Lima", createdAt: new Date("2026-10-18T12:00:00Z") }),
  ];

  it("sem filtro devolve tudo, mais recente primeiro", () => {
    expect(filterAiActions(list, {}).map((r) => r.id)).toEqual(["a", "c", "b"]);
  });

  it("filtra por grupo", () => {
    expect(filterAiActions(list, { group: "decisao" }).map((r) => r.id)).toEqual(["a", "c"]);
    expect(filterAiActions(list, { group: "atendimento" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("busca pelo nome sem diferenciar caixa nem acento", () => {
    expect(filterAiActions(list, { query: "JOAO" }).map((r) => r.id)).toEqual(["b"]);
  });

  it("filtra por data inicial", () => {
    expect(filterAiActions(list, { since: new Date("2026-10-15T00:00:00Z") }).map((r) => r.id)).toEqual(["a", "c"]);
  });
});
