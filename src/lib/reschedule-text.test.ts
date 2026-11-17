import { describe, expect, it } from "vitest";
import { rescheduleTextProblem, RESCHEDULE_TEXT_MAX } from "./reschedule-text";

const ok = "Olá {{nome}}, o Dr(a). {{medico}} não poderá atender no dia {{data}}. Responda para remarcar.";

describe("rescheduleTextProblem (aviso de remarcação sai sem aceite de marketing)", () => {
  it("aceita o aviso com médico e data", () => {
    expect(rescheduleTextProblem(ok)).toBeNull();
  });
  it("recusa vazio", () => {
    expect(rescheduleTextProblem("   ")).toMatch(/texto/i);
  });
  it("exige {{medico}} e {{data}} — é o que faz dele um aviso de remarcação", () => {
    expect(rescheduleTextProblem("Olá {{nome}}, promoção de check-up esta semana!")).toMatch(/medico/);
    expect(rescheduleTextProblem("Olá, o Dr(a). {{medico}} não atende amanhã.")).toMatch(/data/);
  });
  it("recusa link", () => {
    expect(rescheduleTextProblem(`${ok} Veja https://promo.exemplo.com`)).toMatch(/link/i);
    expect(rescheduleTextProblem(`${ok} www.exemplo.com`)).toMatch(/link/i);
  });
  it("recusa texto longo demais", () => {
    expect(rescheduleTextProblem(ok + "x".repeat(RESCHEDULE_TEXT_MAX))).toMatch(/caracteres/);
  });
});
