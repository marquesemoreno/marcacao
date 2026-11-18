import { describe, expect, it } from "vitest";
import {
  AUTOMATION_TEMPLATES,
  MISSED_TAG,
  findClinicalTerm,
  missedTagUpdate,
  templateInput,
  templateSuggestions,
  type AutomationTemplateKey,
} from "./clinic-automation-templates";
import { validateTagAutomation, MAX_EXTRA_STEPS } from "./tag-automations";

const KEYS = AUTOMATION_TEMPLATES.map((t) => t.key);

describe("findClinicalTerm", () => {
  it.each([
    ["Seu exame está pronto"],
    ["Retorno da cirurgia"],
    ["Consulta com o urologista"],
    ["Resultado da biópsia"],
    ["Tratamento do câncer"],
    ["Avaliação da próstata"],
    ["Agendar sua vasectomia"],
    ["Sua mamografia"],
    ["Seu procedimento"],
  ])("acha termo clínico em %s", (text) => {
    expect(findClinicalTerm(text)).not.toBeNull();
  });

  it.each(["Olá, {{1}}! Tudo bem?", "Quer que a gente veja um novo horário?", "Estamos à disposição para conversar", "Sua consulta está em aberto"])(
    "não acusa texto neutro: %s",
    (text) => expect(findClinicalTerm(text)).toBeNull(),
  );
});

describe("catálogo de modelos", () => {
  it("tem os quatro modelos combinados, com chaves únicas", () => {
    expect(KEYS).toEqual(["PAROU_ANTES_DE_MARCAR", "PEDIDO_NAO_MARCADO", "ORCAMENTO_EM_DECISAO", "FALTOU"]);
  });

  it.each(KEYS)("%s nasce desligado, em revisão e para quando o paciente responde", (key) => {
    const input = templateInput(key);
    expect(input.active).toBe(false);
    expect(input.mode).toBe("REVIEW");
    expect(input.stopOnReply).toBe(true);
  });

  it.each(KEYS)("%s passa na validação das automações", (key) => {
    expect(validateTagAutomation(templateInput(key))).toBeNull();
    expect(templateInput(key).extraSteps.length).toBeLessThanOrEqual(MAX_EXTRA_STEPS);
  });

  it.each(KEYS)("%s: nenhum texto para o paciente nomeia doença, exame, procedimento ou especialidade", (key) => {
    for (const text of templateSuggestions(key)) {
      if (text) expect(findClinicalTerm(text.body), text.body).toBeNull();
    }
  });

  it.each(KEYS)("%s: cada mensagem tem um texto sugerido para pedir o modelo à Meta, com {{1}} = nome", (key) => {
    const input = templateInput(key);
    const steps = [input, ...input.extraSteps];
    const suggestions = templateSuggestions(key);
    expect(suggestions).toHaveLength(steps.length);
    steps.forEach((step, i) => {
      if (step.action === "MESSAGE") {
        expect(suggestions[i]?.body).toContain("{{1}}");
        expect(suggestions[i]?.name).toMatch(/^[a-z0-9_]+$/);
        expect(step.cloudTemplateName).toBeNull();
      } else {
        expect(suggestions[i]).toBeNull();
      }
    });
  });

  it("modelo desconhecido não tem sugestão", () => {
    expect(templateSuggestions("NADA" as AutomationTemplateKey)).toEqual([]);
    expect(templateSuggestions(null)).toEqual([]);
  });

  it("conversa parada: conta o tempo sem mensagem, em atendimento, e fecha no fim", () => {
    const input = templateInput("PAROU_ANTES_DE_MARCAR");
    expect(input).toMatchObject({ triggerKind: "STAGE", stage: "TRIAGEM", waitFrom: "LAST_MESSAGE", delayHours: 24 });
    const actions = [input.action, ...input.extraSteps.map((s) => s.action)];
    expect(actions.filter((a) => a === "MESSAGE")).toHaveLength(3);
    expect(actions.at(-1)).toBe("LOST");
    // 3 mensagens em até 10 dias.
    const messageHours = [input.delayHours, ...input.extraSteps.filter((s) => s.action === "MESSAGE").map((s) => s.delayHours)];
    expect(messageHours.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(10 * 24);
  });

  it("orçamento em decisão: 4 mensagens em cerca de 3 meses, depois da fila de orçamentos", () => {
    const input = templateInput("ORCAMENTO_EM_DECISAO");
    expect(input).toMatchObject({ triggerKind: "STAGE", stage: "ORCAMENTO", waitFrom: "ENTRY" });
    const all = [input, ...input.extraSteps];
    expect(all.filter((s) => s.action === "MESSAGE")).toHaveLength(4);
    // A fila de orçamentos (3/7/15 dias) vem antes.
    expect(input.delayHours).toBeGreaterThan(15 * 24);
    const total = all.reduce((a, s) => a + s.delayHours, 0);
    expect(total).toBeGreaterThanOrEqual(80 * 24);
    expect(total).toBeLessThanOrEqual(100 * 24);
  });

  it("faltou: começa 2 h depois da tag, 3 mensagens em 11 dias, e termina em tarefa para ligar", () => {
    const input = templateInput("FALTOU");
    expect(input).toMatchObject({ triggerKind: "TAG", tag: MISSED_TAG, delayHours: 2, serviceNotice: true });
    const all = [input, ...input.extraSteps];
    const messages = all.filter((s) => s.action === "MESSAGE");
    expect(messages).toHaveLength(3);
    const untilLastMessage = all.slice(0, all.lastIndexOf(messages[2]) + 1).reduce((a, s) => a + s.delayHours, 0);
    expect(untilLastMessage).toBeLessThanOrEqual(11 * 24 + 2);
    const last = all.at(-1)!;
    expect(last.action).toBe("REMINDER");
    expect(last.reminderText).toMatch(/ligar/i);
  });

  it("pedido não marcado: dispara pela tag e termina em tarefa para a recepção", () => {
    const input = templateInput("PEDIDO_NAO_MARCADO");
    expect(input.triggerKind).toBe("TAG");
    expect(input.tag.trim()).not.toBe("");
    expect([input, ...input.extraSteps].at(-1)!.action).toBe("REMINDER");
  });
});

describe("missedTagUpdate (tag de falta pela Agenda)", () => {
  it("marcou falta: põe a tag", () => {
    expect(missedTagUpdate(["A"], "NO_SHOW")).toEqual(["A", MISSED_TAG]);
  });
  it("já tinha a tag: não mexe", () => {
    expect(missedTagUpdate([MISSED_TAG], "NO_SHOW")).toBeNull();
  });
  it("desfez a falta: tira a tag", () => {
    expect(missedTagUpdate(["A", MISSED_TAG], "COMPLETED")).toEqual(["A"]);
    expect(missedTagUpdate([MISSED_TAG], "AUTO")).toEqual([]);
  });
  it("outro status sem a tag: não mexe", () => {
    expect(missedTagUpdate(["A"], "CANCELLED")).toBeNull();
  });
});
