import { describe, expect, it } from "vitest";
import { agendaTopic, inboxTopic } from "./realtime-topic";

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

describe("inboxTopic (auditoria B5)", () => {
  it("não revela o id da clínica e muda com o segredo", () => {
    const t = inboxTopic("clinic-abc", "s1");
    expect(t).toMatch(/^inbox-[0-9a-f]{32}$/);
    expect(t).not.toContain("clinic-abc");
    expect(inboxTopic("clinic-abc", "s2")).not.toBe(t);
  });
  it("clínicas e admin têm canais diferentes", () => {
    expect(inboxTopic("a", "s")).not.toBe(inboxTopic("b", "s"));
    expect(inboxTopic(null, "s")).not.toBe(inboxTopic("a", "s"));
    expect(inboxTopic("a", "s")).not.toBe(agendaTopic("a", "s").replace("agenda-", "inbox-"));
  });
});
