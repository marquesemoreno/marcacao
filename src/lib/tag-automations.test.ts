import { describe, expect, it } from "vitest";
import {
  REMINDER_TAG,
  idlePostponedDue,
  planEnrollments,
  sameTrigger,
  triggerWhere,
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
    triggerKind: "TAG",
    stage: null,
    waitFrom: "ENTRY",
    stopOnReply: false,
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

describe("gatilho por etapa, tempo parado e parada na resposta", () => {
  const base: TagAutomationInput = {
    name: "Orçamento parado",
    triggerKind: "STAGE",
    stage: "ORCAMENTO",
    tag: "",
    delayHours: 72,
    waitFrom: "LAST_MESSAGE",
    stopOnReply: true,
    action: "REMINDER",
    mode: "REVIEW",
    reminderText: "Ligar para o paciente",
    cloudTemplateName: null,
    cloudTemplateParams: [],
    active: true,
  };

  it("gatilho por etapa não precisa de tag, mas precisa de uma etapa do CRM", () => {
    expect(validateTagAutomation(base)).toBeNull();
    expect(validateTagAutomation({ ...base, stage: null })).toMatch(/etapa/i);
    expect(validateTagAutomation({ ...base, stage: "INVENTADA" })).toMatch(/etapa/i);
  });

  it("recusa gatilho e contagem desconhecidos", () => {
    expect(validateTagAutomation({ ...base, triggerKind: "X" as never })).toMatch(/gatilho/i);
    expect(validateTagAutomation({ ...base, waitFrom: "X" as never })).toMatch(/espera/i);
  });

  it("tempo parado precisa de pelo menos 1 hora de espera", () => {
    expect(validateTagAutomation({ ...base, delayHours: 0 })).toMatch(/parad/i);
  });

  it("triggerWhere filtra por tag ou por etapa em aberto, sempre na clínica", () => {
    expect(triggerWhere({ clinicId: "c1", triggerKind: "TAG", tag: "Natação", stage: null })).toEqual({ clinicId: "c1", tags: { has: "Natação" } });
    expect(triggerWhere({ clinicId: "c1", triggerKind: "STAGE", tag: "", stage: "ORCAMENTO" })).toEqual({
      clinicId: "c1",
      funnelStage: "ORCAMENTO",
      status: { not: "RESOLVED" },
    });
  });

  it("sameTrigger percebe troca de tag, de etapa e de tipo", () => {
    const a = { triggerKind: "TAG", tag: "Natação", stage: null };
    expect(sameTrigger(a, { ...a })).toBe(true);
    expect(sameTrigger(a, { ...a, tag: "Palmilhas" })).toBe(false);
    expect(sameTrigger(a, { triggerKind: "STAGE", tag: "", stage: "NOVOS" })).toBe(false);
    expect(sameTrigger({ triggerKind: "STAGE", tag: "", stage: "NOVOS" }, { triggerKind: "STAGE", tag: "", stage: "ORCAMENTO" })).toBe(false);
  });

  it("tempo parado: se houve mensagem depois, adia para a última mensagem + espera", () => {
    const now = new Date("2026-11-11T15:00:00Z");
    // última mensagem há 1 dia, espera de 3 dias → faltam 2 dias
    expect(idlePostponedDue({ lastMessageAt: new Date("2026-11-10T15:00:00Z"), delayHours: 72, now })).toEqual(new Date("2026-11-13T15:00:00Z"));
    // última mensagem há 4 dias → já está parado o bastante
    expect(idlePostponedDue({ lastMessageAt: new Date("2026-11-07T15:00:00Z"), delayHours: 72, now })).toBeNull();
    expect(idlePostponedDue({ lastMessageAt: null, delayHours: 72, now })).toBeNull();
  });
});
