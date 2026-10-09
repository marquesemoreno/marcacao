import { describe, it, expect } from "vitest";
import { reopenIfResolved } from "./conversation-reopen";

describe("reopenIfResolved", () => {
  it("ao reabrir uma conversa RESOLVED, libera o atendente e limpa os campos de resolução", () => {
    // Bug real: paciente já atendido manda mensagem dias depois, a conversa reabre
    // (status volta pra OPEN) mas ficava presa no mesmo atendente de antes — que pode
    // não estar mais online (ex: turno da manhã) — e nunca aparecia em Não Atribuídas.
    const result = reopenIfResolved({ status: "RESOLVED" });

    expect(result).toEqual({
      status: "OPEN",
      assignedUserId: null,
      resolvedAt: null,
      resolutionReason: null,
      resolutionNotes: null,
    });
  });

  it("não mexe em nada se a conversa não estava resolvida", () => {
    expect(reopenIfResolved({ status: "OPEN" })).toEqual({ status: "OPEN" });
    expect(reopenIfResolved({ status: "PENDING" })).toEqual({ status: "PENDING" });
  });

  it("finalizada automaticamente há menos de 48h: volta pra mesma atendente", () => {
    const now = new Date("2026-10-09T15:00:00Z");
    const result = reopenIfResolved(
      { status: "RESOLVED", resolutionReason: "INATIVIDADE", resolvedAt: new Date("2026-10-08T18:00:00Z") },
      now
    );
    expect(result).toEqual({ status: "OPEN", resolvedAt: null, resolutionReason: null, resolutionNotes: null });
    expect(
      reopenIfResolved({ status: "RESOLVED", resolutionReason: "ATENDIMENTO_CONCLUIDO", resolvedAt: new Date("2026-10-09T10:00:00Z") }, now)
    ).not.toHaveProperty("assignedUserId");
  });

  it("finalizada automaticamente há mais de 48h, ou à mão: libera o atendente como antes", () => {
    const now = new Date("2026-10-09T15:00:00Z");
    expect(
      reopenIfResolved({ status: "RESOLVED", resolutionReason: "INATIVIDADE", resolvedAt: new Date("2026-10-07T10:00:00Z") }, now)
    ).toHaveProperty("assignedUserId", null);
    expect(
      reopenIfResolved({ status: "RESOLVED", resolutionReason: "DUVIDA_ESCLARECIDA", resolvedAt: new Date("2026-10-09T14:00:00Z") }, now)
    ).toHaveProperty("assignedUserId", null);
  });
});
