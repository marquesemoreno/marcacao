"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicSession } from "@/lib/session";
import { displayName } from "@/lib/contact-display";
import { dueDateToInstant, endOfBrtDay, validateTaskInput } from "@/lib/reception-tasks";

export type TaskView = {
  id: string;
  text: string;
  /** ISO, ou null sem prazo. */
  dueAt: string | null;
  done: boolean;
  doneAt: string | null;
  assignedUserId: string | null;
  assigneeName: string | null;
  conversationId: string | null;
  patientName: string | null;
  /** Nome da automação que criou (null = criado por alguém da equipe). */
  source: string | null;
  createdByName: string | null;
};

const DONE_LIMIT = 50;

/** Tarefas da clínica. "mine" = os meus e os sem responsável. Concluídos: só os 50 últimos. */
export async function listTasks(input: { scope: "mine" | "all"; includeDone: boolean }): Promise<TaskView[]> {
  const { clinicId, userId } = await requireClinicSession();
  const mine = input.scope === "mine" ? { OR: [{ assignedUserId: userId }, { assignedUserId: null }] } : {};
  const [open, done] = await Promise.all([
    prisma.receptionTask.findMany({ where: { clinicId, doneAt: null, ...mine }, orderBy: { createdAt: "asc" }, take: 500 }),
    input.includeDone ? prisma.receptionTask.findMany({ where: { clinicId, doneAt: { not: null }, ...mine }, orderBy: { doneAt: "desc" }, take: DONE_LIMIT }) : Promise.resolve([]),
  ]);
  const rows = [...open, ...done];
  if (rows.length === 0) return [];

  const userIds = [...new Set(rows.flatMap((r) => [r.assignedUserId, r.createdByUserId]).filter((id): id is string => !!id))];
  const conversationIds = [...new Set(rows.map((r) => r.conversationId).filter((id): id is string => !!id))];
  const [users, conversations] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds }, clinicId }, select: { id: true, name: true } }) : Promise.resolve([]),
    conversationIds.length
      ? prisma.conversation.findMany({
          where: { id: { in: conversationIds }, clinicId },
          select: { id: true, contact: { select: { name: true, phone: true, instagramUsername: true } } },
        })
      : Promise.resolve([]),
  ]);
  const userName = new Map(users.map((u) => [u.id, u.name]));
  const patient = new Map(conversations.map((c) => [c.id, displayName(c.contact)]));

  return rows.map((r) => ({
    id: r.id,
    text: r.text,
    dueAt: r.dueAt?.toISOString() ?? null,
    done: r.doneAt !== null,
    doneAt: r.doneAt?.toISOString() ?? null,
    assignedUserId: r.assignedUserId,
    assigneeName: r.assignedUserId ? (userName.get(r.assignedUserId) ?? null) : null,
    conversationId: r.conversationId && patient.has(r.conversationId) ? r.conversationId : null,
    patientName: r.conversationId ? (patient.get(r.conversationId) ?? null) : null,
    source: r.source,
    createdByName: r.createdByUserId ? (userName.get(r.createdByUserId) ?? null) : null,
  }));
}

/** Equipe da clínica (para escolher o responsável) + quem está logado. */
export async function listTaskAssignees(): Promise<{ me: string; users: { id: string; name: string }[] }> {
  const { clinicId, userId } = await requireClinicSession();
  const users = await prisma.user.findMany({ where: { clinicId, clinicRole: { not: "MEDICO" } }, select: { id: true, name: true }, orderBy: { name: "asc" } });
  return { me: userId, users: users.map((u) => ({ id: u.id, name: u.name ?? "Sem nome" })) };
}

/** Nome do paciente de uma conversa da clínica (atalho "Criar tarefa" do Chat). */
export async function getTaskPatient(conversationId: string): Promise<{ conversationId: string; name: string } | null> {
  const { clinicId } = await requireClinicSession();
  const c = await prisma.conversation.findFirst({
    where: { id: conversationId, clinicId },
    select: { id: true, contact: { select: { name: true, phone: true, instagramUsername: true } } },
  });
  return c ? { conversationId: c.id, name: displayName(c.contact) } : null;
}

export async function createTask(input: { text: string; dueDate: string | null; assignedUserId: string | null; conversationId: string | null }) {
  const { clinicId, userId } = await requireClinicSession();
  const invalid = validateTaskInput(input);
  if (invalid) return { success: false as const, error: invalid };
  // Responsável e conversa têm que ser desta clínica.
  if (input.assignedUserId && !(await prisma.user.findFirst({ where: { id: input.assignedUserId, clinicId, clinicRole: { not: "MEDICO" } }, select: { id: true } }))) {
    return { success: false as const, error: "Responsável não encontrado na clínica." };
  }
  if (input.conversationId && !(await prisma.conversation.findFirst({ where: { id: input.conversationId, clinicId }, select: { id: true } }))) {
    return { success: false as const, error: "Conversa não encontrada." };
  }
  await prisma.receptionTask.create({
    data: {
      clinicId,
      text: input.text.trim(),
      dueAt: dueDateToInstant(input.dueDate),
      assignedUserId: input.assignedUserId,
      conversationId: input.conversationId,
      createdByUserId: userId,
    },
  });
  revalidatePath("/clinic/tarefas");
  return { success: true as const };
}

/** Conclui ou reabre. */
export async function setTaskDone(id: string, done: boolean) {
  const { clinicId, userId } = await requireClinicSession();
  const { count } = await prisma.receptionTask.updateMany({
    where: { id, clinicId },
    data: done ? { doneAt: new Date(), doneByUserId: userId } : { doneAt: null, doneByUserId: null },
  });
  if (count === 0) return { success: false as const, error: "Tarefa não encontrada." };
  revalidatePath("/clinic/tarefas");
  return { success: true as const };
}

export async function deleteTask(id: string) {
  const { clinicId } = await requireClinicSession();
  const { count } = await prisma.receptionTask.deleteMany({ where: { id, clinicId } });
  if (count === 0) return { success: false as const, error: "Tarefa não encontrada." };
  revalidatePath("/clinic/tarefas");
  return { success: true as const };
}

export async function updateTask(id: string, input: { text: string; dueDate: string | null; assignedUserId: string | null }) {
  const { clinicId } = await requireClinicSession();
  const invalid = validateTaskInput(input);
  if (invalid) return { success: false as const, error: invalid };
  if (input.assignedUserId && !(await prisma.user.findFirst({ where: { id: input.assignedUserId, clinicId, clinicRole: { not: "MEDICO" } }, select: { id: true } }))) {
    return { success: false as const, error: "Responsável não encontrado na clínica." };
  }
  const { count } = await prisma.receptionTask.updateMany({
    where: { id, clinicId },
    data: { text: input.text.trim(), dueAt: dueDateToInstant(input.dueDate), assignedUserId: input.assignedUserId },
  });
  if (count === 0) return { success: false as const, error: "Tarefa não encontrada." };
  revalidatePath("/clinic/tarefas");
  return { success: true as const };
}

/** Contador do menu: tarefas abertas, minhas ou sem responsável, atrasadas ou para hoje. */
export async function getMyDueTaskCount(now = new Date()): Promise<number> {
  const { clinicId, userId } = await requireClinicSession();
  return prisma.receptionTask.count({
    where: { clinicId, doneAt: null, dueAt: { lte: endOfBrtDay(now) }, OR: [{ assignedUserId: userId }, { assignedUserId: null }] },
  });
}
