import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  tagAutomation: { findFirst: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  clinic: { findUniqueOrThrow: vi.fn() },
}));
const mocks = vi.hoisted(() => ({ requireClinicPermission: vi.fn(), getAutomationCloudSetup: vi.fn(), resetBaseline: vi.fn() }));

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => ({ requireClinicPermission: mocks.requireClinicPermission }));
vi.mock("@/actions/automation-rules", () => ({ getAutomationCloudSetup: mocks.getAutomationCloudSetup }));
vi.mock("@/lib/tag-automations-run", () => ({ resetBaseline: mocks.resetBaseline }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { deleteTagAutomation, saveTagAutomation } from "./tag-automations";
import type { TagAutomationInput } from "@/lib/tag-automations";

const input: TagAutomationInput = {
  name: "Aula experimental",
  triggerKind: "TAG",
  tag: "Aula experimental",
  stage: null,
  waitFrom: "ENTRY",
  stopOnReply: false,
  serviceNotice: false,
  delayHours: 24,
  action: "MESSAGE",
  mode: "REVIEW",
  reminderText: "",
  cloudTemplateName: "pos_aula",
  cloudTemplateParams: ["{{nome}}"],
  extraSteps: [],
  active: true,
};
const template = { name: "pos_aula", language: "pt_BR", category: "MARKETING", bodyText: "Oi {{1}}", variableCount: 1 };
const utility = { name: "laudo_pronto", language: "pt_BR", category: "UTILITY", bodyText: "Oi {{1}}, seu laudo está pronto", variableCount: 1 };

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.requireClinicPermission.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
  mocks.getAutomationCloudSetup.mockResolvedValue({ active: true, templates: [template, utility] });
  mocks.resetBaseline.mockResolvedValue(7);
  db.tagAutomation.count.mockResolvedValue(0);
  db.tagAutomation.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "a1", ...data }));
  db.tagAutomation.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "a1", ...data }));
});

describe("saveTagAutomation", () => {
  it("cria na clínica da sessão, exige a permissão de disparos e marca quem já tinha a tag", async () => {
    const r = await saveTagAutomation(input);
    expect(mocks.requireClinicPermission).toHaveBeenCalledWith("disparos");
    expect(db.tagAutomation.create.mock.calls[0][0].data).toMatchObject({ clinicId: "clinic-a", tag: "Aula experimental", mode: "REVIEW", cloudTemplateName: "pos_aula", cloudTemplateBody: "Oi {{1}}" });
    expect(mocks.resetBaseline).toHaveBeenCalledWith({ id: "a1", clinicId: "clinic-a", triggerKind: "TAG", tag: "Aula experimental", stage: null }, expect.any(Date));
    expect(r).toEqual({ success: true, id: "a1", alreadyTagged: 7 });
  });

  it("não edita automação de outra clínica", async () => {
    db.tagAutomation.findFirst.mockResolvedValue(null);
    const r = await saveTagAutomation({ ...input, id: "de-outra" });
    expect(db.tagAutomation.findFirst.mock.calls[0][0].where).toEqual({ id: "de-outra", clinicId: "clinic-a" });
    expect(r).toEqual({ success: false, error: "Automação não encontrada." });
    expect(db.tagAutomation.update).not.toHaveBeenCalled();
  });

  it("salvar sem ligar não marca ninguém; religar marca de novo", async () => {
    await saveTagAutomation({ ...input, active: false });
    expect(mocks.resetBaseline).not.toHaveBeenCalled();
    db.tagAutomation.findFirst.mockResolvedValue({ id: "a1", clinicId: "clinic-a", active: false, triggerKind: "TAG", tag: "Aula experimental", stage: null });
    await saveTagAutomation({ ...input, id: "a1", active: true });
    expect(mocks.resetBaseline).toHaveBeenCalledTimes(1);
  });

  it("editar ligada sem trocar a tag não refaz a marcação", async () => {
    db.tagAutomation.findFirst.mockResolvedValue({ id: "a1", clinicId: "clinic-a", active: true, triggerKind: "TAG", tag: "Aula experimental", stage: null });
    await saveTagAutomation({ ...input, id: "a1", delayHours: 48 });
    expect(mocks.resetBaseline).not.toHaveBeenCalled();
  });

  it("gatilho por etapa grava a etapa, deixa a tag vazia e marca quem já está na etapa", async () => {
    await saveTagAutomation({ ...input, triggerKind: "STAGE", stage: "ORCAMENTO", tag: "qualquer", waitFrom: "LAST_MESSAGE", stopOnReply: true });
    expect(db.tagAutomation.create.mock.calls[0][0].data).toMatchObject({ triggerKind: "STAGE", stage: "ORCAMENTO", tag: "", waitFrom: "LAST_MESSAGE", stopOnReply: true });
    expect(mocks.resetBaseline).toHaveBeenCalledWith({ id: "a1", clinicId: "clinic-a", triggerKind: "STAGE", tag: "", stage: "ORCAMENTO" }, expect.any(Date));
  });

  it("trocar a etapa com a automação ligada refaz a marcação", async () => {
    db.tagAutomation.findFirst.mockResolvedValue({ id: "a1", clinicId: "clinic-a", active: true, triggerKind: "STAGE", tag: "", stage: "NOVOS" });
    await saveTagAutomation({ ...input, id: "a1", triggerKind: "STAGE", stage: "ORCAMENTO", tag: "" });
    expect(mocks.resetBaseline).toHaveBeenCalledTimes(1);
  });

  it("mensagem não liga sem a API oficial", async () => {
    mocks.getAutomationCloudSetup.mockResolvedValue({ active: false, templates: [template] });
    const r = await saveTagAutomation(input);
    expect(r.success).toBe(false);
    expect(db.tagAutomation.create).not.toHaveBeenCalled();
  });

  it("enviar sozinho exige responsável técnico", async () => {
    db.clinic.findUniqueOrThrow.mockResolvedValue({ technicalDirectorName: null, technicalDirectorCrm: null });
    const r = await saveTagAutomation({ ...input, mode: "AUTO" });
    expect(r).toMatchObject({ success: false });
    expect(db.tagAutomation.create).not.toHaveBeenCalled();
  });

  it("aviso de serviço recusa modelo de marketing", async () => {
    const r = await saveTagAutomation({ ...input, serviceNotice: true });
    expect(r).toMatchObject({ success: false });
    expect(db.tagAutomation.create).not.toHaveBeenCalled();
  });

  it("aviso de serviço com modelo de utilidade salva e envia sozinho sem responsável técnico", async () => {
    db.clinic.findUniqueOrThrow.mockResolvedValue({ technicalDirectorName: null, technicalDirectorCrm: null });
    const r = await saveTagAutomation({ ...input, serviceNotice: true, mode: "AUTO", cloudTemplateName: "laudo_pronto" });
    expect(r.success).toBe(true);
    expect(db.tagAutomation.create.mock.calls[0][0].data).toMatchObject({ serviceNotice: true, cloudTemplateName: "laudo_pronto" });
  });

  it("lembrete nunca fica marcado como aviso de serviço", async () => {
    await saveTagAutomation({ ...input, action: "REMINDER", cloudTemplateName: null, reminderText: "Cobrar", serviceNotice: true });
    expect(db.tagAutomation.create.mock.calls[0][0].data.serviceNotice).toBe(false);
  });

  it("sequência: guarda os passos seguintes com idioma e texto do modelo de cada um", async () => {
    await saveTagAutomation({
      ...input,
      extraSteps: [
        { delayHours: 120, action: "MESSAGE", reminderText: "", cloudTemplateName: "laudo_pronto", cloudTemplateParams: ["{{nome}}"] },
        { delayHours: 72, action: "LOST", reminderText: "x", cloudTemplateName: null, cloudTemplateParams: [] },
      ],
    });
    expect(db.tagAutomation.create.mock.calls[0][0].data.extraSteps).toEqual([
      { delayHours: 120, action: "MESSAGE", reminderText: "", cloudTemplateName: "laudo_pronto", cloudTemplateLanguage: "pt_BR", cloudTemplateBody: "Oi {{1}}, seu laudo está pronto", cloudTemplateParams: ["{{nome}}"] },
      { delayHours: 72, action: "LOST", reminderText: "", cloudTemplateName: null, cloudTemplateLanguage: null, cloudTemplateBody: null, cloudTemplateParams: [] },
    ]);
  });

  it("sequência: modelo inexistente num passo seguinte recusa tudo", async () => {
    const r = await saveTagAutomation({ ...input, extraSteps: [{ delayHours: 24, action: "MESSAGE", reminderText: "", cloudTemplateName: "nao_existe", cloudTemplateParams: [] }] });
    expect(r.success).toBe(false);
    expect(db.tagAutomation.create).not.toHaveBeenCalled();
  });

  it("aviso de serviço confere a categoria também nos passos seguintes", async () => {
    const r = await saveTagAutomation({
      ...input,
      serviceNotice: true,
      cloudTemplateName: "laudo_pronto",
      extraSteps: [{ delayHours: 24, action: "MESSAGE", reminderText: "", cloudTemplateName: "pos_aula", cloudTemplateParams: ["{{nome}}"] }],
    });
    expect(r.success).toBe(false);
  });

  it("lembrete liga sem API oficial e sem modelo", async () => {
    mocks.getAutomationCloudSetup.mockResolvedValue({ active: false, templates: [] });
    const r = await saveTagAutomation({ ...input, action: "REMINDER", cloudTemplateName: null, reminderText: "Cobrar o convênio" });
    expect(r.success).toBe(true);
    expect(db.tagAutomation.create.mock.calls[0][0].data).toMatchObject({ action: "REMINDER", reminderText: "Cobrar o convênio", cloudTemplateName: null });
  });

  it("respeita o limite de automações por clínica", async () => {
    db.tagAutomation.count.mockResolvedValue(30);
    expect((await saveTagAutomation(input)).success).toBe(false);
  });
});

describe("deleteTagAutomation", () => {
  it("apaga só dentro da clínica da sessão", async () => {
    db.tagAutomation.deleteMany.mockResolvedValue({ count: 0 });
    expect(await deleteTagAutomation("de-outra")).toEqual({ success: false, error: "Automação não encontrada." });
    expect(db.tagAutomation.deleteMany).toHaveBeenCalledWith({ where: { id: "de-outra", clinicId: "clinic-a" } });
  });
});
