import { describe, expect, it } from "vitest";
import { agendaTopic } from "./realtime-topic";

describe("agendaTopic", () => {
  it("estável por clínica, diferente entre clínicas, sem o id em claro", () => {
    const a = agendaTopic("clinicA", "segredo");
    expect(agendaTopic("clinicA", "segredo")).toBe(a);
    expect(agendaTopic("clinicB", "segredo")).not.toBe(a);
    expect(agendaTopic("clinicA", "outro")).not.toBe(a);
    expect(a).not.toContain("clinicA");
    expect(a).toMatch(/^agenda-[a-f0-9]{32}$/);
  });
});
