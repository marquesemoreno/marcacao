import { describe, it, expect } from "vitest";
import { computeResponseTimingsFromMessages, type TimingMessage } from "./response-timings";

function msg(partial: Partial<Omit<TimingMessage, "createdAt">> & { createdAt: string }): TimingMessage {
  return {
    direction: "INBOUND",
    type: "TEXT",
    content: "",
    ...partial,
    createdAt: new Date(partial.createdAt),
  };
}

describe("computeResponseTimingsFromMessages", () => {
  it("calcula FRT normal: resposta depois da mensagem do paciente", () => {
    const result = computeResponseTimingsFromMessages(
      [
        msg({ direction: "INBOUND", createdAt: "2026-01-01T10:00:00Z" }),
        msg({ direction: "OUTBOUND", createdAt: "2026-01-01T10:05:00Z" }),
      ],
      null
    );
    expect(result.firstResponseSec).toBe(300);
  });

  it("ignora mensagem OUTBOUND proativa enviada ANTES do primeiro INBOUND (bug real: clínica manda nota fiscal/lembrete antes do paciente escrever)", () => {
    const result = computeResponseTimingsFromMessages(
      [
        msg({ direction: "OUTBOUND", content: "Segue nota fiscal", createdAt: "2026-01-01T10:00:00Z" }),
        msg({ direction: "INBOUND", createdAt: "2026-01-01T10:10:00Z" }),
        msg({ direction: "OUTBOUND", content: "Disponha", createdAt: "2026-01-01T10:15:00Z" }),
      ],
      null
    );
    expect(result.firstResponseSec).toBe(300);
    expect(result.firstResponseSec).toBeGreaterThanOrEqual(0);
  });

  it("retorna null quando não há nenhuma resposta real depois do primeiro INBOUND", () => {
    const result = computeResponseTimingsFromMessages(
      [
        msg({ direction: "OUTBOUND", content: "Mensagem antes do paciente", createdAt: "2026-01-01T10:00:00Z" }),
        msg({ direction: "INBOUND", createdAt: "2026-01-01T10:10:00Z" }),
      ],
      null
    );
    expect(result.firstResponseSec).toBeNull();
  });

  it("ignora nota interna e mensagem automática como resposta", () => {
    const result = computeResponseTimingsFromMessages(
      [
        msg({ direction: "INBOUND", createdAt: "2026-01-01T10:00:00Z" }),
        msg({ direction: "OUTBOUND", type: "INTERNAL_NOTE", content: "nota", createdAt: "2026-01-01T10:01:00Z" }),
        msg({ direction: "OUTBOUND", content: "resposta de verdade", createdAt: "2026-01-01T10:08:00Z" }),
      ],
      null
    );
    expect(result.firstResponseSec).toBe(480);
  });

  it("retorna null quando não há mensagem INBOUND nenhuma", () => {
    const result = computeResponseTimingsFromMessages(
      [msg({ direction: "OUTBOUND", createdAt: "2026-01-01T10:00:00Z" })],
      null
    );
    expect(result.firstResponseSec).toBeNull();
    expect(result.resolutionSec).toBeNull();
  });

  it("calcula TTR a partir do primeiro INBOUND até resolvedAt", () => {
    const result = computeResponseTimingsFromMessages(
      [msg({ direction: "INBOUND", createdAt: "2026-01-01T10:00:00Z" })],
      new Date("2026-01-01T11:00:00Z")
    );
    expect(result.resolutionSec).toBe(3600);
  });
});
