import { describe, it, expect } from "vitest";
import { rebookingConversationUpdate } from "./rebooking";
import { RESCHEDULE_PENDING_TAG, CONFIRMED_TAG } from "./conversation-tags";

const now = new Date("2026-10-19T15:00:00Z");

describe("rebookingConversationUpdate", () => {
  it("marca remarcação pendente e deixa a conversa aberta", () => {
    const out = rebookingConversationUpdate({ status: "OPEN", tags: ["VIP"] }, now);
    expect(out.status).toBe("OPEN");
    expect(out.tags).toEqual(["VIP", RESCHEDULE_PENDING_TAG]);
  });

  it("troca a tag de resultado anterior em vez de acumular (confirmado deixa de valer)", () => {
    const out = rebookingConversationUpdate({ status: "OPEN", tags: [CONFIRMED_TAG, "VIP"] }, now);
    expect(out.tags).toEqual(["VIP", RESCHEDULE_PENDING_TAG]);
  });

  it("não duplica a tag quando já está marcada", () => {
    const out = rebookingConversationUpdate({ status: "OPEN", tags: [RESCHEDULE_PENDING_TAG] }, now);
    expect(out.tags).toEqual([RESCHEDULE_PENDING_TAG]);
  });

  it("reabre conversa finalizada, limpa o desfecho e devolve para a fila sem dono", () => {
    const out = rebookingConversationUpdate(
      { status: "RESOLVED", tags: [], resolutionReason: "AGENDAMENTO_CONCLUIDO", resolvedAt: new Date("2026-10-10T12:00:00Z") },
      now
    );
    expect(out).toMatchObject({
      status: "OPEN",
      assignedUserId: null,
      resolvedAt: null,
      resolutionReason: null,
      resolutionNotes: null,
    });
  });
});
