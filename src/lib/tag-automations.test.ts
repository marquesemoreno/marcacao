import { describe, expect, it } from "vitest";
import {
  REMINDER_TAG,
  planEnrollments,
  reminderNote,
  tagAutomationCampaignName,
  validateTagAutomation,
  type TagAutomationInput,
} from "./tag-automations";
import { WRONG_NUMBER_TAG } from "./conversation-tags";

const now = new Date("2026-11-11T15:00:00Z");

describe("planEnrollments", () => {
  it("quem recebeu a tag e ainda não está na automação entra, com vencimento depois da espera", () => {
    const plan = planEnrollments({ delayHours: 24, taggedConversationIds: ["c1", "c2"], existing: [], now });
    expect(plan.removeIds).toEqual([]);
    expect(plan.create).toEqual([
      { conversationId: "c1", dueAt: new Date("2026-11-12T15:00:00Z") },
      { conversationId: "c2", dueAt: new Date("2026-11-12T15:00:00Z") },
    ]);
  });

  it("sem espera, vence na hora", () => {
    const plan = planEnrollments({ delayHours: 0, taggedConversationIds: ["c1"], existing: [], now });
    expect(plan.create).toEqual([{ conversationId: "c1", dueAt: now }]);
  });

  it("quem já está na automação não entra de novo, em qualquer situação", () => {
    const existing = [
      { id: "e1", conversationId: "c1", status: "PENDING" },
      { id: "e2", conversationId: "c2", status: "DONE" },
      { id: "e3", conversationId: "c3", status: "BASELINE" },
    ];
    const plan = planEnrollments({ delayHours: 0, taggedConversationIds: ["c1", "c2", "c3"], existing, now });
    expect(plan).toEqual({ create: [], removeIds: [] });
  });

  it("quando a tag sai, a entrada some: cancela o que estava pendente e libera um novo disparo se a tag voltar", () => {
    const existing = [
      { id: "e1", conversationId: "c1", status: "PENDING" },
      { id: "e2", conversationId: "c2", status: "DONE" },
    ];
    const plan = planEnrollments({ delayHours: 0, taggedConversationIds: [], existing, now });
    expect(plan).toEqual({ create: [], removeIds: ["e1", "e2"] });
  });

  it("conversa repetida na lista entra uma vez só", () => {
    const plan = planEnrollments({ delayHours: 0, taggedConversationIds: ["c1", "c1"], existing: [], now });
    expect(plan.create).toHaveLength(1);
  });
});

describe("validateTagAutomation", () => {
  const base: TagAutomationInput = {
    name: "Aula experimental",
    tag: "Aula experimental",
    delayHours: 24,
    action: "MESSAGE",
    mode: "REVIEW",
    reminderText: "",
    cloudTemplateName: "pos_aula",
    cloudTemplateParams: ["{{nome}}"],
    active: true,
  };

  it("aceita uma automação completa", () => {
    expect(validateTagAutomation(base)).toBeNull();
  });

  it("exige nome e tag", () => {
    expect(validateTagAutomation({ ...base, name: "  " })).toMatch(/nome/i);
    expect(validateTagAutomation({ ...base, tag: "" })).toMatch(/tag/i);
  });

  it("não deixa usar como gatilho as tags que tiram o paciente dos envios", () => {
    expect(validateTagAutomation({ ...base, tag: WRONG_NUMBER_TAG })).toMatch(/tag/i);
    expect(validateTagAutomation({ ...base, tag: REMINDER_TAG })).toMatch(/tag/i);
  });

  it("espera entre 0 e 30 dias, em horas inteiras", () => {
    expect(validateTagAutomation({ ...base, delayHours: -1 })).toMatch(/espera/i);
    expect(validateTagAutomation({ ...base, delayHours: 721 })).toMatch(/espera/i);
    expect(validateTagAutomation({ ...base, delayHours: 1.5 })).toMatch(/espera/i);
    expect(validateTagAutomation({ ...base, delayHours: 720 })).toBeNull();
  });

  it("mensagem ligada precisa de modelo aprovado; desligada pode ficar sem", () => {
    expect(validateTagAutomation({ ...base, cloudTemplateName: null })).toMatch(/modelo/i);
    expect(validateTagAutomation({ ...base, cloudTemplateName: null, active: false })).toBeNull();
  });

  it("lembrete precisa de texto e não precisa de modelo", () => {
    expect(validateTagAutomation({ ...base, action: "REMINDER", cloudTemplateName: null, reminderText: " " })).toMatch(/lembrete/i);
    expect(validateTagAutomation({ ...base, action: "REMINDER", cloudTemplateName: null, reminderText: "Cobrar o convênio" })).toBeNull();
  });

  it("recusa ação e modo desconhecidos", () => {
    expect(validateTagAutomation({ ...base, action: "OUTRA" as never })).toMatch(/ação/i);
    expect(validateTagAutomation({ ...base, mode: "X" as never })).toMatch(/modo/i);
  });
});

describe("textos", () => {
  it("nome da campanha traz a automação e o dia em Brasília", () => {
    expect(tagAutomationCampaignName("Aula experimental", new Date("2026-11-12T01:30:00Z"))).toBe("Automação · Aula experimental · 11/11");
  });

  it("nota do lembrete identifica a automação", () => {
    expect(reminderNote("Convênio", "Cobrar a autorização")).toBe("🔔 Lembrete automático (Convênio): Cobrar a autorização");
  });
});
