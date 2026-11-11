import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tagAutomation: { findMany: vi.fn() },
  clinic: { findMany: vi.fn() },
  conversation: { findMany: vi.fn(), update: vi.fn() },
  tagAutomationEnrollment: { findMany: vi.fn(), findFirst: vi.fn(), deleteMany: vi.fn(), createMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  whatsappCloudAccount: { findUnique: vi.fn() },
  broadcastCampaign: { findFirst: vi.fn(), create: vi.fn() },
  broadcastRecipient: { findMany: vi.fn(), createMany: vi.fn() },
  user: { findFirst: vi.fn() },
  message: { create: vi.fn(), findMany: vi.fn() },
  webhookLog: { create: vi.fn() },
  receptionTask: { create: vi.fn() },
}));
vi.mock("@/lib/prisma", () => ({ prisma: db }));

import { resetBaseline, runTagAutomations } from "./tag-automations-run";
import { DEMO_CLINIC_CNPJ } from "./demo-clinic";
import { WRONG_NUMBER_TAG } from "./conversation-tags";

const now = new Date("2026-11-11T15:00:00Z");
const automation = (over: Record<string, unknown> = {}) => ({
  id: "a1",
  clinicId: "clinic-a",
  name: "Aula experimental",
  triggerKind: "TAG",
  tag: "Aula experimental",
  stage: null,
  waitFrom: "ENTRY",
  stopOnReply: false,
  serviceNotice: false,
  delayHours: 0,
  action: "MESSAGE",
  mode: "REVIEW",
  reminderText: null,
  cloudTemplateName: "pos_aula",
  cloudTemplateLanguage: "pt_BR",
  cloudTemplateBody: "Oi {{1}}, como foi a aula?",
  cloudTemplateParams: ["{{nome}}"],
  extraSteps: [] as unknown[],
  active: true,
  ...over,
});
const conv = (id: string, phone: string | null, name: string, tags: string[], lastMessageAt: Date | null = null) => ({ id, status: "OPEN", tags, lastMessageAt, assignedUserId: "u-dona", contact: { phone, name } });

/** Fila já sincronizada: `due` são as entradas vencidas, `convs` as conversas delas. */
/** Campanhas em que a automação já pôs gente hoje (para o teste de reaproveitar o rascunho). */
let campaignsToday: { campaignId: string }[] = [];

function setup(a: ReturnType<typeof automation>, due: { id: string; conversationId: string; createdAt?: Date; stepIndex?: number }[], convs: ReturnType<typeof conv>[]) {
  db.tagAutomation.findMany.mockResolvedValue([a]);
  db.clinic.findMany.mockResolvedValue([{ id: "clinic-a", cnpj: "11", technicalDirectorName: "Dra. Ana", technicalDirectorCrm: "123" }]);
  db.conversation.findMany.mockImplementation(async (args: { where: { id?: unknown } }) =>
    args.where.id ? convs : convs.map((c) => ({ id: c.id })),
  );
  db.message.findMany.mockResolvedValue([]);
  db.tagAutomationEnrollment.findMany.mockImplementation(async (args: { where: { status?: string; campaignId?: unknown } }) =>
    args.where.campaignId ? campaignsToday : args.where.status === "PENDING" ? due : due.map((d) => ({ ...d, status: "PENDING" })),
  );
  db.whatsappCloudAccount.findUnique.mockResolvedValue({ active: true });
  db.user.findFirst.mockResolvedValue({ id: "u1" });
  db.broadcastCampaign.create.mockResolvedValue({ id: "camp1" });
  db.webhookLog.create.mockResolvedValue({});
}

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  campaignsToday = [];
});

describe("runTagAutomations — mensagem", () => {
  it("modo revisão: cria campanha em rascunho com o modelo e marca as entradas como feitas", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    const [result] = await runTagAutomations(now);
    expect(result).toMatchObject({ status: "campanha", count: 1 });
    const data = db.broadcastCampaign.create.mock.calls[0][0].data;
    expect(data).toMatchObject({ clinicId: "clinic-a", status: "DRAFT", lowPriority: true, cloudTemplateName: "pos_aula", name: "Automação · Aula experimental · 11/11" });
    expect(data.recipients.create).toEqual([{ phone: "5577900000001", variables: { nome: "Ana", saudacao: "Oi, Ana" }, status: "PENDING" }]);
    expect(db.tagAutomationEnrollment.updateMany.mock.calls[0][0]).toMatchObject({ where: { id: { in: ["e1"] } }, data: { status: "DONE", campaignId: "camp1" } });
  });

  it("modo automático: a campanha já nasce enviando", async () => {
    setup(automation({ mode: "AUTO" }), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create.mock.calls[0][0].data.status).toBe("RUNNING");
  });

  it("modo automático sem responsável técnico não envia e deixa a fila esperando", async () => {
    setup(automation({ mode: "AUTO" }), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    db.clinic.findMany.mockResolvedValue([{ id: "clinic-a", cnpj: "11", technicalDirectorName: null, technicalDirectorCrm: null }]);
    const [result] = await runTagAutomations(now);
    expect(result.status).toBe("sem responsável técnico");
    expect(db.broadcastCampaign.create).not.toHaveBeenCalled();
    expect(db.tagAutomationEnrollment.updateMany).not.toHaveBeenCalled();
  });

  it("campanha comum nasce sem marca; aviso de serviço nasce marcado e não exige responsável técnico", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create.mock.calls[0][0].data.tagOnSend).toBeNull();

    db.broadcastCampaign.create.mockClear();
    setup(automation({ mode: "AUTO", serviceNotice: true }), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    db.clinic.findMany.mockResolvedValue([{ id: "clinic-a", cnpj: "11", technicalDirectorName: null, technicalDirectorCrm: null }]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create.mock.calls[0][0].data).toMatchObject({ tagOnSend: "__aviso_de_servico__", status: "RUNNING" });
  });

  it("sem API oficial ativa não cria campanha", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    db.whatsappCloudAccount.findUnique.mockResolvedValue({ active: false });
    const [result] = await runTagAutomations(now);
    expect(result.status).toBe("sem API oficial ativa");
    expect(db.broadcastCampaign.create).not.toHaveBeenCalled();
  });

  it("pula sem telefone, número errado e telefone repetido", async () => {
    setup(
      automation(),
      [
        { id: "e1", conversationId: "c1" },
        { id: "e2", conversationId: "c2" },
        { id: "e3", conversationId: "c3" },
        { id: "e4", conversationId: "c4" },
      ],
      [
        conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"]),
        conv("c2", null, "perfil_insta", ["Aula experimental"]),
        conv("c3", "5577900000003", "Caio Reis", ["Aula experimental", WRONG_NUMBER_TAG]),
        conv("c4", "5577900000001", "Ana Lima", ["Aula experimental"]),
      ],
    );
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create.mock.calls[0][0].data.recipients.create.map((r: { phone: string }) => r.phone)).toEqual(["5577900000001"]);
    const skipped = db.tagAutomationEnrollment.update.mock.calls.map((c) => [c[0].where.id, c[0].data.note]);
    expect(skipped).toEqual([
      ["e2", "sem telefone"],
      ["e3", "número errado"],
      ["e4", "telefone repetido"],
    ]);
  });

  it("no mesmo dia, entra na campanha em rascunho que já existe em vez de criar outra", async () => {
    setup(automation(), [{ id: "e2", conversationId: "c2" }], [conv("c2", "5577900000002", "Bruno Reis", ["Aula experimental"])]);
    campaignsToday = [{ campaignId: "camp0" }];
    db.broadcastCampaign.findFirst.mockResolvedValue({ id: "camp0" });
    db.broadcastRecipient.findMany.mockResolvedValue([]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.findFirst.mock.calls[0][0].where).toEqual({ id: { in: ["camp0"] }, clinicId: "clinic-a", status: "DRAFT", name: "Automação · Aula experimental · 11/11" });
    expect(db.broadcastCampaign.create).not.toHaveBeenCalled();
    expect(db.broadcastRecipient.createMany.mock.calls[0][0].data).toEqual([
      { campaignId: "camp0", phone: "5577900000002", variables: { nome: "Bruno", saudacao: "Oi, Bruno" }, status: "PENDING" },
    ]);
  });

  it("busca as conversas sempre dentro da clínica da automação", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    for (const call of db.conversation.findMany.mock.calls) expect(call[0].where.clinicId).toBe("clinic-a");
  });
});

describe("runTagAutomations — lembrete", () => {
  it("deixa nota interna, cria a tarefa na lista com quem atende a conversa e não cria campanha", async () => {
    setup(automation({ action: "REMINDER", reminderText: "Cobrar o convênio", cloudTemplateName: null }), [{ id: "e1", conversationId: "c1" }], [
      conv("c1", "5577900000001", "Ana Lima", ["Aguardando convênio"]),
    ]);
    const [result] = await runTagAutomations(now);
    expect(result).toMatchObject({ status: "lembretes", count: 1 });
    expect(db.message.create.mock.calls[0][0].data).toMatchObject({
      conversationId: "c1",
      type: "INTERNAL_NOTE",
      content: "🔔 Lembrete automático (Aula experimental): Cobrar o convênio",
    });
    expect(db.receptionTask.create.mock.calls[0][0].data).toEqual({
      clinicId: "clinic-a",
      conversationId: "c1",
      text: "Cobrar o convênio",
      dueAt: now,
      assignedUserId: "u-dona",
      source: "Aula experimental",
    });
    expect(db.conversation.update).not.toHaveBeenCalled();
    expect(db.broadcastCampaign.create).not.toHaveBeenCalled();
    expect(db.whatsappCloudAccount.findUnique).not.toHaveBeenCalled();
  });
});

describe("runTagAutomations — etapa, resposta e tempo parado", () => {
  it("gatilho por etapa procura conversas em aberto naquela etapa da clínica", async () => {
    setup(automation({ triggerKind: "STAGE", tag: "", stage: "ORCAMENTO" }), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", [])]);
    await runTagAutomations(now);
    expect(db.conversation.findMany.mock.calls[0][0].where).toEqual({ clinicId: "clinic-a", funnelStage: "ORCAMENTO", status: { not: "RESOLVED" } });
    expect(db.broadcastCampaign.create).toHaveBeenCalled();
  });

  it("parar na resposta: quem escreveu depois de entrar sai da fila e não recebe", async () => {
    const entered = new Date("2026-11-10T15:00:00Z");
    setup(
      automation({ stopOnReply: true }),
      [
        { id: "e1", conversationId: "c1", createdAt: entered },
        { id: "e2", conversationId: "c2", createdAt: entered },
      ],
      [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"]), conv("c2", "5577900000002", "Bruno Reis", ["Aula experimental"])],
    );
    db.message.findMany.mockResolvedValue([{ conversationId: "c1", createdAt: new Date("2026-11-11T10:00:00Z") }]);
    await runTagAutomations(now);
    expect(db.message.findMany.mock.calls[0][0].where).toMatchObject({ direction: "INBOUND", conversationId: { in: ["c1", "c2"] } });
    expect(db.tagAutomationEnrollment.update.mock.calls[0][0]).toMatchObject({ where: { id: "e1" }, data: { status: "SKIPPED", note: "paciente respondeu" } });
    expect(db.broadcastCampaign.create.mock.calls[0][0].data.recipients.create.map((r: { phone: string }) => r.phone)).toEqual(["5577900000002"]);
  });

  it("resposta anterior à entrada na automação não cancela", async () => {
    setup(automation({ stopOnReply: true }), [{ id: "e1", conversationId: "c1", createdAt: new Date("2026-11-11T12:00:00Z") }], [
      conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"]),
    ]);
    db.message.findMany.mockResolvedValue([{ conversationId: "c1", createdAt: new Date("2026-11-11T09:00:00Z") }]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create).toHaveBeenCalled();
  });

  it("sem parar na resposta, nem consulta as mensagens", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    expect(db.message.findMany).not.toHaveBeenCalled();
  });

  it("tempo parado: conversa com mensagem recente é adiada em vez de disparar", async () => {
    setup(
      automation({ waitFrom: "LAST_MESSAGE", delayHours: 72 }),
      [
        { id: "e1", conversationId: "c1" },
        { id: "e2", conversationId: "c2" },
      ],
      [
        conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"], new Date("2026-11-10T15:00:00Z")),
        conv("c2", "5577900000002", "Bruno Reis", ["Aula experimental"], new Date("2026-11-01T15:00:00Z")),
      ],
    );
    await runTagAutomations(now);
    expect(db.tagAutomationEnrollment.update.mock.calls[0][0]).toEqual({ where: { id: "e1" }, data: { dueAt: new Date("2026-11-13T15:00:00Z") } });
    expect(db.broadcastCampaign.create.mock.calls[0][0].data.recipients.create.map((r: { phone: string }) => r.phone)).toEqual(["5577900000002"]);
  });
});

describe("runTagAutomations — sequência de passos", () => {
  const lost = { delayHours: 72, action: "LOST", reminderText: "", cloudTemplateName: null, cloudTemplateLanguage: null, cloudTemplateBody: null, cloudTemplateParams: [] };
  const second = { delayHours: 120, action: "MESSAGE", reminderText: "", cloudTemplateName: "toque_2", cloudTemplateLanguage: "pt_BR", cloudTemplateBody: "Ainda dá tempo", cloudTemplateParams: [] };

  it("depois do primeiro passo, a conversa volta para a fila esperando o segundo", async () => {
    setup(automation({ extraSteps: [second, lost] }), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create.mock.calls[0][0].data).toMatchObject({ name: "Automação · Aula experimental · passo 1 · 11/11", cloudTemplateName: "pos_aula" });
    expect(db.tagAutomationEnrollment.updateMany.mock.calls[0][0].data).toMatchObject({
      status: "PENDING",
      stepIndex: 1,
      dueAt: new Date("2026-11-16T15:00:00Z"),
      campaignId: "camp1",
    });
  });

  it("o segundo passo usa o modelo dele e deixa o terceiro agendado", async () => {
    setup(automation({ extraSteps: [second, lost] }), [{ id: "e1", conversationId: "c1", stepIndex: 1 }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    expect(db.broadcastCampaign.create.mock.calls[0][0].data).toMatchObject({ name: "Automação · Aula experimental · passo 2 · 11/11", cloudTemplateName: "toque_2", cloudTemplateBody: "Ainda dá tempo" });
    expect(db.tagAutomationEnrollment.updateMany.mock.calls[0][0].data).toMatchObject({ status: "PENDING", stepIndex: 2, dueAt: new Date("2026-11-14T15:00:00Z") });
  });

  it("último passo 'finalizar': conversa vira finalizada por falta de resposta, com nota, sem mensagem ao paciente", async () => {
    setup(automation({ extraSteps: [second, lost] }), [{ id: "e1", conversationId: "c1", stepIndex: 2 }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    const [result] = await runTagAutomations(now);
    expect(result).toMatchObject({ status: "finalizadas", count: 1 });
    expect(db.conversation.update.mock.calls[0][0]).toEqual({
      where: { id: "c1" },
      data: { status: "RESOLVED", resolutionReason: "SEM_RESPOSTA", resolutionNotes: "Automação: Aula experimental", resolvedAt: now },
    });
    expect(db.message.create.mock.calls[0][0].data).toMatchObject({ conversationId: "c1", type: "INTERNAL_NOTE" });
    expect(db.tagAutomationEnrollment.update.mock.calls[0][0]).toEqual({ where: { id: "e1" }, data: { status: "DONE", doneAt: now } });
    expect(db.broadcastCampaign.create).not.toHaveBeenCalled();
  });

  it("conversa já finalizada não é finalizada de novo", async () => {
    const c = { ...conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"]), status: "RESOLVED" };
    setup(automation({ extraSteps: [lost] }), [{ id: "e1", conversationId: "c1", stepIndex: 1 }], [c]);
    await runTagAutomations(now);
    expect(db.conversation.update).not.toHaveBeenCalled();
    expect(db.message.create).not.toHaveBeenCalled();
  });

  it("parar na resposta vale também nos passos seguintes", async () => {
    setup(automation({ stopOnReply: true, extraSteps: [second, lost] }), [{ id: "e1", conversationId: "c1", stepIndex: 2, createdAt: new Date("2026-11-01T15:00:00Z") }], [
      conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"]),
    ]);
    db.message.findMany.mockResolvedValue([{ conversationId: "c1", createdAt: new Date("2026-11-09T10:00:00Z") }]);
    await runTagAutomations(now);
    expect(db.tagAutomationEnrollment.update.mock.calls[0][0].data).toMatchObject({ status: "SKIPPED", note: "paciente respondeu" });
    expect(db.conversation.update).not.toHaveBeenCalled();
  });

  it("lembrete no meio da sequência também agenda o passo seguinte", async () => {
    setup(automation({ action: "REMINDER", reminderText: "Ligar", cloudTemplateName: null, extraSteps: [lost] }), [{ id: "e1", conversationId: "c1" }], [
      conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"]),
    ]);
    await runTagAutomations(now);
    expect(db.tagAutomationEnrollment.update.mock.calls[0][0].data).toMatchObject({ status: "PENDING", stepIndex: 1, dueAt: new Date("2026-11-14T15:00:00Z") });
  });

  it("se a sequência encolheu, a conversa que estava num passo que não existe mais é encerrada", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1", stepIndex: 3 }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    await runTagAutomations(now);
    expect(db.tagAutomationEnrollment.update.mock.calls[0][0]).toEqual({ where: { id: "e1" }, data: { status: "DONE", doneAt: now } });
    expect(db.broadcastCampaign.create).not.toHaveBeenCalled();
  });
});

describe("runTagAutomations — gerais", () => {
  it("clínica demo nunca roda", async () => {
    setup(automation(), [{ id: "e1", conversationId: "c1" }], [conv("c1", "5577900000001", "Ana Lima", ["Aula experimental"])]);
    db.clinic.findMany.mockResolvedValue([{ id: "clinic-a", cnpj: DEMO_CLINIC_CNPJ, technicalDirectorName: null, technicalDirectorCrm: null }]);
    expect(await runTagAutomations(now)).toEqual([]);
    expect(db.conversation.findMany).not.toHaveBeenCalled();
  });

  it("nada vencido: não envia nem registra log", async () => {
    setup(automation(), [], []);
    const [result] = await runTagAutomations(now);
    expect(result.status).toBe("nada vencido");
    expect(db.webhookLog.create).not.toHaveBeenCalled();
  });
});

describe("resetBaseline", () => {
  it("ao ligar, quem já tem a tag entra como BASELINE e não como pendente", async () => {
    db.conversation.findMany.mockResolvedValue([{ id: "c1" }, { id: "c2" }]);
    const count = await resetBaseline({ id: "a1", clinicId: "clinic-a", triggerKind: "TAG", tag: "Natação", stage: null }, now);
    expect(count).toBe(2);
    expect(db.tagAutomationEnrollment.deleteMany).toHaveBeenCalledWith({ where: { automationId: "a1" } });
    expect(db.conversation.findMany.mock.calls[0][0].where).toEqual({ clinicId: "clinic-a", tags: { has: "Natação" } });
    expect(db.tagAutomationEnrollment.createMany.mock.calls[0][0].data.map((d: { status: string }) => d.status)).toEqual(["BASELINE", "BASELINE"]);
  });
});
