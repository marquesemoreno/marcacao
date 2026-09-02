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
});
