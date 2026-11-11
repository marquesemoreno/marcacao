import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  receptionTask: { findMany: vi.fn(), create: vi.fn(), updateMany: vi.fn(), deleteMany: vi.fn() },
  user: { findMany: vi.fn(), findFirst: vi.fn() },
  conversation: { findMany: vi.fn(), findFirst: vi.fn() },
}));
const requireClinicSession = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: db }));
vi.mock("@/lib/session", () => ({ requireClinicSession }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { createTask, deleteTask, getTaskPatient, listTasks, setTaskDone } from "./reception-tasks";

beforeEach(() => {
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  requireClinicSession.mockReset();
  requireClinicSession.mockResolvedValue({ clinicId: "clinic-a", userId: "u1" });
});

describe("createTask", () => {
  it("cria na clínica da sessão, com prazo no fim do dia e autor", async () => {
    db.user.findFirst.mockResolvedValue({ id: "u2" });
    db.conversation.findFirst.mockResolvedValue({ id: "c1" });
    const r = await createTask({ text: " Cobrar o convênio ", dueDate: "2026-11-20", assignedUserId: "u2", conversationId: "c1" });
    expect(r).toEqual({ success: true });
    expect(db.receptionTask.create.mock.calls[0][0].data).toEqual({
      clinicId: "clinic-a",
      text: "Cobrar o convênio",
      dueAt: new Date("2026-11-21T02:59:00Z"),
      assignedUserId: "u2",
      conversationId: "c1",
      createdByUserId: "u1",
    });
  });

  it("recusa responsável de outra clínica", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const r = await createTask({ text: "Ligar", dueDate: null, assignedUserId: "de-outra", conversationId: null });
    expect(db.user.findFirst.mock.calls[0][0].where).toMatchObject({ id: "de-outra", clinicId: "clinic-a" });
    expect(r.success).toBe(false);
    expect(db.receptionTask.create).not.toHaveBeenCalled();
  });

  it("recusa conversa de outra clínica", async () => {
    db.conversation.findFirst.mockResolvedValue(null);
    const r = await createTask({ text: "Ligar", dueDate: null, assignedUserId: null, conversationId: "de-outra" });
    expect(db.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "de-outra", clinicId: "clinic-a" });
    expect(r.success).toBe(false);
    expect(db.receptionTask.create).not.toHaveBeenCalled();
  });

  it("recusa texto vazio sem tocar no banco", async () => {
    expect((await createTask({ text: " ", dueDate: null, assignedUserId: null, conversationId: null })).success).toBe(false);
    expect(db.receptionTask.create).not.toHaveBeenCalled();
  });
});

describe("concluir e excluir", () => {
  it("conclui só dentro da clínica e registra quem concluiu", async () => {
    db.receptionTask.updateMany.mockResolvedValue({ count: 1 });
    await setTaskDone("r1", true);
    const call = db.receptionTask.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: "r1", clinicId: "clinic-a" });
    expect(call.data).toMatchObject({ doneByUserId: "u1" });
    expect(call.data.doneAt).toBeInstanceOf(Date);
  });

  it("reabrir limpa a conclusão", async () => {
    db.receptionTask.updateMany.mockResolvedValue({ count: 1 });
    await setTaskDone("r1", false);
    expect(db.receptionTask.updateMany.mock.calls[0][0].data).toEqual({ doneAt: null, doneByUserId: null });
  });

  it("tarefa de outra clínica: não conclui nem exclui", async () => {
    db.receptionTask.updateMany.mockResolvedValue({ count: 0 });
    db.receptionTask.deleteMany.mockResolvedValue({ count: 0 });
    expect((await setTaskDone("de-outra", true)).success).toBe(false);
    expect((await deleteTask("de-outra")).success).toBe(false);
    expect(db.receptionTask.deleteMany).toHaveBeenCalledWith({ where: { id: "de-outra", clinicId: "clinic-a" } });
  });
});

describe("listTasks", () => {
  const row = (over: Record<string, unknown>) => ({
    id: "r1",
    text: "Ligar",
    dueAt: null,
    doneAt: null,
    assignedUserId: null,
    conversationId: null,
    createdByUserId: null,
    source: null,
    ...over,
  });

  it("'meus' traz os meus e os sem responsável, sempre da clínica", async () => {
    db.receptionTask.findMany.mockResolvedValue([]);
    await listTasks({ scope: "mine", includeDone: false });
    expect(db.receptionTask.findMany).toHaveBeenCalledTimes(1);
    expect(db.receptionTask.findMany.mock.calls[0][0].where).toEqual({ clinicId: "clinic-a", doneAt: null, OR: [{ assignedUserId: "u1" }, { assignedUserId: null }] });
  });

  it("'todos' não filtra por responsável e busca nomes só dentro da clínica", async () => {
    db.receptionTask.findMany.mockResolvedValueOnce([row({ assignedUserId: "u2", conversationId: "c1", source: "Convênio" })]).mockResolvedValueOnce([]);
    db.user.findMany.mockResolvedValue([{ id: "u2", name: "Bia" }]);
    db.conversation.findMany.mockResolvedValue([{ id: "c1", contact: { name: "ANA LIMA", phone: "5577900000001", instagramUsername: null } }]);
    const rows = await listTasks({ scope: "all", includeDone: true });
    expect(db.receptionTask.findMany.mock.calls[0][0].where).toEqual({ clinicId: "clinic-a", doneAt: null });
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["u2"] }, clinicId: "clinic-a" });
    expect(db.conversation.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["c1"] }, clinicId: "clinic-a" });
    expect(rows[0]).toMatchObject({ assigneeName: "Bia", patientName: "Ana Lima", conversationId: "c1", source: "Convênio", done: false });
  });
});

describe("getTaskPatient", () => {
  it("só devolve conversa da clínica", async () => {
    db.conversation.findFirst.mockResolvedValue(null);
    expect(await getTaskPatient("de-outra")).toBeNull();
    expect(db.conversation.findFirst.mock.calls[0][0].where).toEqual({ id: "de-outra", clinicId: "clinic-a" });
  });
});

describe("responsáveis", () => {
  it("a lista não traz médicos: eles não têm acesso à página de tarefas", async () => {
    db.user.findMany.mockResolvedValue([{ id: "u1", name: "Bia" }]);
    const { listTaskAssignees } = await import("./reception-tasks");
    const r = await listTaskAssignees();
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({ clinicId: "clinic-a", clinicRole: { not: "MEDICO" } });
    expect(r).toEqual({ me: "u1", users: [{ id: "u1", name: "Bia" }] });
  });

  it("criar tarefa para um médico é recusado", async () => {
    db.user.findFirst.mockResolvedValue(null);
    const r = await createTask({ text: "Ligar", dueDate: null, assignedUserId: "medico", conversationId: null });
    expect(db.user.findFirst.mock.calls[0][0].where).toEqual({ id: "medico", clinicId: "clinic-a", clinicRole: { not: "MEDICO" } });
    expect(r.success).toBe(false);
  });
});
