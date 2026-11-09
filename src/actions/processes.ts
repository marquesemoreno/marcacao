"use server";

import { aiChat, isAiConfigured } from "@/lib/ai-gateway";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { isClinicManager } from "@/lib/session";
import {
  DEFAULT_PROCESSES,
  FEEDBACK_STATUSES,
  PROCESS_BODY_MAX,
  interpretProcessAnswer,
  parseFeedback,
  processQuestionPrompt,
  type FeedbackStatus,
} from "@/lib/processes";

const PATH = "/clinic/processos";

/** Cria os modelos (rascunho) na primeira visita da clínica. */
async function ensureDefaults(clinicId: string) {
  const count = await prisma.clinicProcess.count({ where: { clinicId } });
  if (count > 0) return;
  await prisma.clinicProcess.createMany({
    data: DEFAULT_PROCESSES.map((p) => ({ clinicId, sector: p.sector, title: p.title, body: p.body })),
    skipDuplicates: true,
  });
}

/** Processos da clínica: gestão vê rascunhos também; equipe só os publicados. */
export async function listProcesses() {
  const { clinicId, userId } = await requireClinicSession();
  await ensureDefaults(clinicId);
  const manager = await isClinicManager(userId);
  const processes = await prisma.clinicProcess.findMany({
    where: { clinicId, ...(manager ? {} : { status: "PUBLISHED" }) },
    orderBy: { createdAt: "asc" },
    select: { id: true, sector: true, title: true, body: true, status: true, version: true, changeNote: true, publishedAt: true, updatedAt: true },
  });
  return { manager, processes };
}

async function ownProcess(clinicId: string, id: string) {
  const p = await prisma.clinicProcess.findUnique({ where: { id } });
  if (!p || p.clinicId !== clinicId) throw new Error("Processo não encontrado");
  return p;
}

/** Gestão edita o texto. Processo já publicado ganha nova versão com a nota do que mudou. */
export async function saveProcess(id: string, input: { title: string; body: string; changeNote?: string }) {
  const { clinicId, userId } = await requireClinicManager();
  const p = await ownProcess(clinicId, id);
  const title = input.title.trim().slice(0, 120);
  const body = input.body.trim().slice(0, PROCESS_BODY_MAX);
  if (title.length < 3 || body.length < 20) throw new Error("Título ou texto curto demais.");
  const published = p.status === "PUBLISHED";
  await prisma.clinicProcess.update({
    where: { id },
    data: {
      title,
      body,
      updatedByUserId: userId,
      ...(published ? { version: { increment: 1 }, changeNote: input.changeNote?.trim().slice(0, 300) || null, publishedAt: new Date() } : {}),
    },
  });
  revalidatePath(PATH);
}

export async function setProcessPublished(id: string, published: boolean) {
  const { clinicId, userId } = await requireClinicManager();
  await ownProcess(clinicId, id);
  await prisma.clinicProcess.update({
    where: { id },
    data: { status: published ? "PUBLISHED" : "DRAFT", publishedAt: published ? new Date() : null, updatedByUserId: userId },
  });
  revalidatePath(PATH);
}

/** Dúvida: a IA responde só pelo texto do processo. Fica registrada para a gestão ver o que a
 * equipe pergunta; sem resposta no texto, vai como dúvida em aberto. */
export async function askProcess(id: string, question: string): Promise<{ answered: boolean; text: string }> {
  const { clinicId, userId } = await requireClinicSession();
  const p = await ownProcess(clinicId, id);
  const q = question.trim().slice(0, 500);
  if (q.length < 5) throw new Error("Escreva a dúvida.");
  let result: ReturnType<typeof interpretProcessAnswer> = { answered: false };
  if (isAiConfigured()) {
    try {
      const completion = await aiChat({ feature: "processos", clinicId }, {
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: processQuestionPrompt(p.title, p.body) },
          { role: "user", content: q },
        ],
        max_tokens: 300,
        temperature: 0,
      });
      result = interpretProcessAnswer(completion.choices[0]?.message?.content);
    } catch {
      result = { answered: false };
    }
  }
  await prisma.processFeedback.create({
    data: {
      clinicId,
      processId: id,
      userId,
      kind: "DUVIDA",
      text: q,
      aiAnswer: result.answered ? result.text : null,
      status: result.answered ? "RESOLVIDA" : "NOVA",
    },
  });
  revalidatePath(PATH);
  return result.answered
    ? { answered: true, text: result.text }
    : { answered: false, text: "Isso não está no processo. Mandei sua dúvida para a gestão — a resposta aparece em “Minhas mensagens”." };
}

export async function sendProcessFeedback(id: string, input: { kind: string; text: string; anonymous: boolean }) {
  const { clinicId, userId } = await requireClinicSession();
  await ownProcess(clinicId, id);
  const parsed = parseFeedback(input);
  if (!parsed.ok) throw new Error(parsed.error);
  await prisma.processFeedback.create({
    data: { clinicId, processId: id, userId: parsed.anonymous ? null : userId, kind: parsed.kind, text: parsed.text },
  });
  revalidatePath(PATH);
}

/** Gestão: todas as dúvidas/opiniões/reclamações (anônimas sem nome). */
export async function listProcessFeedback() {
  const { clinicId } = await requireClinicManager();
  const rows = await prisma.processFeedback.findMany({
    where: { clinicId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: {
      id: true,
      kind: true,
      text: true,
      status: true,
      aiAnswer: true,
      managerReply: true,
      createdAt: true,
      userId: true,
      process: { select: { title: true } },
    },
  });
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId).filter((v): v is string => !!v) } },
    select: { id: true, name: true },
  });
  const name = new Map(users.map((u) => [u.id, u.name]));
  return rows.map(({ userId, ...r }) => ({ ...r, author: userId ? (name.get(userId) ?? "—") : "Anônimo" }));
}

export async function updateProcessFeedback(id: string, input: { status: string; managerReply?: string }) {
  const { clinicId } = await requireClinicManager();
  const f = await prisma.processFeedback.findUnique({ where: { id }, select: { clinicId: true } });
  if (!f || f.clinicId !== clinicId) throw new Error("Mensagem não encontrada");
  if (!(FEEDBACK_STATUSES as readonly string[]).includes(input.status)) throw new Error("Status inválido");
  await prisma.processFeedback.update({
    where: { id },
    data: {
      status: input.status as FeedbackStatus,
      ...(input.managerReply !== undefined ? { managerReply: input.managerReply.trim().slice(0, 2000) || null } : {}),
    },
  });
  revalidatePath(PATH);
}

/** O que eu mandei (não anônimo) e a resposta da gestão/IA. */
export async function listMyProcessFeedback() {
  const { clinicId, userId } = await requireClinicSession();
  return prisma.processFeedback.findMany({
    where: { clinicId, userId },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, kind: true, text: true, status: true, aiAnswer: true, managerReply: true, createdAt: true, process: { select: { title: true } } },
  });
}
