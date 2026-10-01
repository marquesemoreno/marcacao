import { describe, it, expect } from "vitest";
import { nextTagsForOutcome, CONFIRMED_TAG, CANCELLED_TAG, RESCHEDULED_TAG, URGENCY_TAG } from "./conversation-tags";

describe("nextTagsForOutcome", () => {
  it("adiciona a tag quando a conversa ainda não tem nenhuma das 3", () => {
    expect(nextTagsForOutcome([], CONFIRMED_TAG)).toEqual([CONFIRMED_TAG]);
  });

  it("troca a tag anterior em vez de acumular (Remarcado -> Confirmado)", () => {
    expect(nextTagsForOutcome([RESCHEDULED_TAG], CONFIRMED_TAG)).toEqual([CONFIRMED_TAG]);
  });

  it("não duplica quando a mesma tag já está presente", () => {
    expect(nextTagsForOutcome([CONFIRMED_TAG], CONFIRMED_TAG)).toEqual([CONFIRMED_TAG]);
  });

  it("preserva outras tags não relacionadas ao resultado (urgência, lead, etc)", () => {
    expect(nextTagsForOutcome([URGENCY_TAG, CANCELLED_TAG], CONFIRMED_TAG)).toEqual([URGENCY_TAG, CONFIRMED_TAG]);
  });

  it("mantém a ordem relativa das tags preservadas", () => {
    expect(nextTagsForOutcome(["🩺 Interesse: Ultrassom", RESCHEDULED_TAG, URGENCY_TAG], CANCELLED_TAG)).toEqual([
      "🩺 Interesse: Ultrassom",
      URGENCY_TAG,
      CANCELLED_TAG,
    ]);
  });
});
