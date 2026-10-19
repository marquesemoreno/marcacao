import { describe, it, expect } from "vitest";
import { nextSlotAfter, SLOT_STEP_MINUTES } from "./appointment-slots";

describe("nextSlotAfter", () => {
  it("o passo é de 10 minutos", () => {
    expect(SLOT_STEP_MINUTES).toBe(10);
  });

  it("sem marcação no dia não sugere nada: a atendente digita o primeiro horário", () => {
    expect(nextSlotAfter([])).toBeNull();
  });

  it("soma 10 minutos ao último horário marcado: 08:00 → 08:10 → 08:20", () => {
    expect(nextSlotAfter(["08:00"])).toBe("08:10");
    expect(nextSlotAfter(["08:00", "08:10"])).toBe("08:20");
  });

  it("usa o horário mais tarde do dia, mesmo fora de ordem", () => {
    expect(nextSlotAfter(["09:30", "08:00", "08:10"])).toBe("09:40");
  });

  it("vira a hora corretamente", () => {
    expect(nextSlotAfter(["08:50"])).toBe("09:00");
    expect(nextSlotAfter(["11:55"])).toBe("12:05");
  });

  it("ignora valores que não são horário (ex.: vazio, 'Ordem de chegada')", () => {
    expect(nextSlotAfter(["", "Ordem de chegada", "08:00"])).toBe("08:10");
    expect(nextSlotAfter(["Ordem de chegada"])).toBeNull();
  });

  it("não passa da meia-noite", () => {
    expect(nextSlotAfter(["23:55"])).toBeNull();
  });

  it("aceita passo diferente", () => {
    expect(nextSlotAfter(["08:00"], 15)).toBe("08:15");
  });
});
