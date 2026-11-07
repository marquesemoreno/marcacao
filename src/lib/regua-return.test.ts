import { describe, expect, it } from "vitest";
import { computeReguaReturn } from "./regua-return";

const d = (s: string) => new Date(s);

describe("computeReguaReturn (roteiro 4.5)", () => {
  it("conta resposta e agendamento em até 30 dias após o envio, por passo", () => {
    const r = computeReguaReturn(
      [
        { phone: "5577999990001", kind: "RETORNO", sentAt: d("2026-11-01T12:00:00Z") },
        { phone: "5577999990002", kind: "RETORNO", sentAt: d("2026-11-01T12:00:00Z") },
        { phone: "5577999990003", kind: "REATIVACAO", sentAt: d("2026-11-01T12:00:00Z") },
      ],
      [
        { phone: "5577999990001", inboundAt: [d("2026-11-02T10:00:00Z")], scheduledAt: [d("2026-11-03T10:00:00Z")] },
        // resposta ANTES do envio não conta; agendamento depois de 30 dias também não
        { phone: "5577999990002", inboundAt: [d("2026-10-30T10:00:00Z")], scheduledAt: [d("2026-12-05T10:00:00Z")] },
        { phone: "5577999990003", inboundAt: [d("2026-11-10T10:00:00Z")], scheduledAt: [] },
      ],
      250,
    );
    expect(r.rows).toEqual([
      { kind: "RETORNO", sent: 2, replied: 1, scheduled: 1 },
      { kind: "REATIVACAO", sent: 1, replied: 1, scheduled: 0 },
    ]);
    expect(r.totalScheduled).toBe(1);
    expect(r.estimatedRevenue).toBe(250);
  });

  it("casa telefone com e sem o 9º dígito e conta cada paciente uma vez por passo", () => {
    const r = computeReguaReturn(
      [
        { phone: "557799990001", kind: "RETORNO", sentAt: d("2026-11-01T12:00:00Z") },
        { phone: "557799990001", kind: "RETORNO", sentAt: d("2026-11-02T12:00:00Z") },
      ],
      [{ phone: "5577999990001", inboundAt: [], scheduledAt: [d("2026-11-04T10:00:00Z")] }],
      null,
    );
    expect(r.rows).toEqual([{ kind: "RETORNO", sent: 1, replied: 0, scheduled: 1 }]);
    expect(r.estimatedRevenue).toBeNull();
  });

  it("sem envios", () => {
    expect(computeReguaReturn([], [], 100)).toEqual({ rows: [], totalSent: 0, totalScheduled: 0, estimatedRevenue: null });
  });
});
