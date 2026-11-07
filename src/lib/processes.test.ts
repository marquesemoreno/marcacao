import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROCESSES,
  PROCESS_SECTORS,
  interpretProcessAnswer,
  isProcessSector,
  parseFeedback,
  processQuestionPrompt,
} from "./processes";

describe("processos por setor", () => {
  it("um modelo para cada setor", () => {
    expect(DEFAULT_PROCESSES.map((p) => p.sector).sort()).toEqual([...PROCESS_SECTORS].sort());
    for (const p of DEFAULT_PROCESSES) expect(p.body).toMatch(/^Objetivo:/);
  });
  it("valida setor", () => {
    expect(isProcessSector("CHAT")).toBe(true);
    expect(isProcessSector("FINANCEIRO_X")).toBe(false);
  });
  it("valida opinião/reclamação", () => {
    expect(parseFeedback({ kind: "RECLAMACAO", text: "  O lembrete chega tarde  ", anonymous: true })).toEqual({
      ok: true,
      kind: "RECLAMACAO",
      text: "O lembrete chega tarde",
      anonymous: true,
    });
    expect(parseFeedback({ kind: "XYZ", text: "texto válido" }).ok).toBe(false);
    expect(parseFeedback({ kind: "DUVIDA", text: "oi" }).ok).toBe(false);
    expect(parseFeedback({ kind: "OPINIAO", text: "x".repeat(5000) })).toMatchObject({ ok: true, anonymous: false });
  });
  it("IA responde só pelo processo; NAO_SEI vira dúvida para a gestão", () => {
    expect(processQuestionPrompt("Agendar", "1. passo")).toContain("SOMENTE o texto do processo");
    expect(interpretProcessAnswer("NAO_SEI")).toEqual({ answered: false });
    expect(interpretProcessAnswer("")).toEqual({ answered: false });
    expect(interpretProcessAnswer("Clique em Agendar.")).toEqual({ answered: true, text: "Clique em Agendar." });
  });
});
