import { describe, expect, it } from "vitest";
import { compareQueue, type QueueSortable } from "./queue-order";

const row = (id: string, over: Partial<QueueSortable> = {}): QueueSortable & { id: string } => ({
  id,
  queueState: "HUMANO_ATENDENDO",
  pinned: false,
  sla: { shouldDisplay: false, realWaitingMinutes: 0 },
  ...over,
});
const order = (rows: (QueueSortable & { id: string })[]) => [...rows].sort(compareQueue).map((r) => r.id);
const waiting = (min: number) => ({ shouldDisplay: true, realWaitingMinutes: min });

describe("compareQueue", () => {
  it("quem espera resposta há mais tempo vem primeiro, independente do dono", () => {
    expect(order([row("5min", { sla: waiting(5), queueState: "SEM_DONO" }), row("2h", { sla: waiting(120) }), row("40min", { sla: waiting(40) })])).toEqual([
      "2h",
      "40min",
      "5min",
    ]);
  });
  it("urgência clínica e remarcação pendente continuam no topo", () => {
    expect(order([row("2h", { sla: waiting(120) }), row("urg", { queueState: "URGENCIA_CLINICA", sla: waiting(1) }), row("rem", { queueState: "REMARCACAO_PENDENTE" })])).toEqual([
      "urg",
      "rem",
      "2h",
    ]);
  });
  it("quem não está esperando vem depois: sem dono, fixadas e depois a ordem original", () => {
    expect(order([row("resto"), row("fixada", { pinned: true }), row("semdono", { queueState: "SEM_DONO" }), row("esperando", { sla: waiting(3) })])).toEqual([
      "esperando",
      "semdono",
      "fixada",
      "resto",
    ]);
  });
  it("espera de mais de 48 h (conversa esquecida) vai depois de quem espera hoje", () => {
    expect(order([row("30dias", { sla: waiting(30 * 24 * 60) }), row("10min", { sla: waiting(10) }), row("3h", { sla: waiting(180) })])).toEqual([
      "3h",
      "10min",
      "30dias",
    ]);
  });
  it("esquecidas ficam antes de quem não está esperando, na ordem original", () => {
    expect(order([row("resto"), row("esq-a", { sla: waiting(5000) }), row("esq-b", { sla: waiting(9000) })])).toEqual(["esq-a", "esq-b", "resto"]);
  });
});
