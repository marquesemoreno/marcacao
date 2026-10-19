import { describe, it, expect } from "vitest";
import {
  DEFAULT_LOSS_REASONS,
  resolveLossReasons,
  normalizeLossReasonLabel,
  customLossReasonId,
  customLossReasonLabel,
} from "./loss-reasons";

describe("normalizeLossReasonLabel", () => {
  it("apara, junta espaços repetidos e limita o tamanho", () => {
    expect(normalizeLossReasonLabel("  Foi   para  outra clínica ")).toBe("Foi para outra clínica");
    expect(normalizeLossReasonLabel("x".repeat(80))).toHaveLength(40);
  });

  it("recusa vazio", () => {
    expect(normalizeLossReasonLabel("   ")).toBeNull();
    expect(normalizeLossReasonLabel("")).toBeNull();
  });
});

describe("custom loss reason id", () => {
  it("o id carrega o próprio rótulo (relatórios continuam legíveis se o motivo for removido depois)", () => {
    const id = customLossReasonId("Foi para outra clínica");
    expect(id).toBe("PERDA_CUSTOM:Foi para outra clínica");
    expect(customLossReasonLabel(id)).toBe("Foi para outra clínica");
  });

  it("motivos padrão não são personalizados", () => {
    expect(customLossReasonLabel("PERDA_PRECO")).toBeNull();
    expect(customLossReasonLabel("AGENDAMENTO_CONCLUIDO")).toBeNull();
  });
});

describe("resolveLossReasons", () => {
  it("sem motivos da clínica devolve os padrões, 'Outro motivo' por último", () => {
    const ids = resolveLossReasons([]).map((r) => r.id);
    expect(ids).toEqual(["PERDA_PRECO", "PERDA_CONVENIO", "PERDA_HORARIO", "PERDA_OUTRO"]);
    expect(DEFAULT_LOSS_REASONS.map((r) => r.id)).toContain("PERDA_OUTRO");
  });

  it("coloca os da clínica antes de 'Outro motivo'", () => {
    const out = resolveLossReasons(["Foi para outra clínica", "Sem vaga"]);
    expect(out.map((r) => r.label)).toEqual([
      "Preço",
      "Convênio não atendido",
      "Horário / agenda",
      "Foi para outra clínica",
      "Sem vaga",
      "Outro motivo",
    ]);
    expect(out[3].id).toBe("PERDA_CUSTOM:Foi para outra clínica");
  });

  it("ignora repetidos (sem diferenciar caixa/acento) e os que repetem um padrão", () => {
    const out = resolveLossReasons(["Sem vaga", "sem  vaga", "PREÇO", "Convenio não atendido", "  "]);
    expect(out.map((r) => r.label)).toEqual(["Preço", "Convênio não atendido", "Horário / agenda", "Sem vaga", "Outro motivo"]);
  });
});
