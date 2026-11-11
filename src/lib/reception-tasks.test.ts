import { describe, expect, it } from "vitest";
import { dueDateToInstant, groupTasks, taskBucket, validateTaskInput } from "./reception-tasks";

// 11/11/2026 12:00 em Brasília
const now = new Date("2026-11-11T15:00:00Z");

describe("taskBucket", () => {
  it("separa atrasado, hoje e próximos pelo dia de Brasília", () => {
    expect(taskBucket({ done: false, dueAt: new Date("2026-11-10T15:00:00Z") }, now)).toBe("OVERDUE");
    expect(taskBucket({ done: false, dueAt: new Date("2026-11-11T03:00:00Z") }, now)).toBe("TODAY");
    expect(taskBucket({ done: false, dueAt: new Date("2026-11-12T02:59:00Z") }, now)).toBe("TODAY");
    expect(taskBucket({ done: false, dueAt: new Date("2026-11-12T03:00:00Z") }, now)).toBe("UPCOMING");
  });

  it("sem prazo fica em próximos; concluído vai para concluídos mesmo atrasado", () => {
    expect(taskBucket({ done: false, dueAt: null }, now)).toBe("UPCOMING");
    expect(taskBucket({ done: true, dueAt: new Date("2026-11-01T15:00:00Z") }, now)).toBe("DONE");
  });
});

describe("groupTasks", () => {
  it("agrupa e ordena: prazo mais antigo primeiro, sem prazo por último", () => {
    const rows = [
      { id: "sem", done: false, dueAt: null },
      { id: "amanha", done: false, dueAt: new Date("2026-11-12T15:00:00Z") },
      { id: "ontem", done: false, dueAt: new Date("2026-11-10T15:00:00Z") },
      { id: "anteontem", done: false, dueAt: new Date("2026-11-09T15:00:00Z") },
      { id: "hoje", done: false, dueAt: new Date("2026-11-11T15:00:00Z") },
      { id: "feito", done: true, dueAt: null },
    ];
    const g = groupTasks(rows, now);
    expect(g.OVERDUE.map((r) => r.id)).toEqual(["anteontem", "ontem"]);
    expect(g.TODAY.map((r) => r.id)).toEqual(["hoje"]);
    expect(g.UPCOMING.map((r) => r.id)).toEqual(["amanha", "sem"]);
    expect(g.DONE.map((r) => r.id)).toEqual(["feito"]);
  });
});

describe("validateTaskInput", () => {
  it("exige texto de até 300 letras", () => {
    expect(validateTaskInput({ text: "  ", dueDate: null })).toMatch(/tarefa/i);
    expect(validateTaskInput({ text: "x".repeat(301), dueDate: null })).toMatch(/300/);
    expect(validateTaskInput({ text: "Ligar para o convênio", dueDate: null })).toBeNull();
  });

  it("prazo é opcional, mas precisa ser uma data válida", () => {
    expect(validateTaskInput({ text: "Ligar", dueDate: "2026-11-20" })).toBeNull();
    expect(validateTaskInput({ text: "Ligar", dueDate: "20/11/2026" })).toMatch(/prazo/i);
    expect(validateTaskInput({ text: "Ligar", dueDate: "2026-02-31" })).toMatch(/prazo/i);
  });
});

describe("dueDateToInstant", () => {
  it("o prazo vale até o fim do dia em Brasília", () => {
    expect(dueDateToInstant("2026-11-20")).toEqual(new Date("2026-11-21T02:59:00Z"));
    expect(dueDateToInstant(null)).toBeNull();
  });
});
