"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClinicRole, requireClinicPermission, requireClinicSession } from "@/lib/session";
import { can } from "@/lib/clinic-permissions";
import { startOfBrazilDay } from "@/lib/broadcast-schedule";
import { groupWaitingBoard, RETURN_MINUTE_OPTIONS, waitingSince } from "@/lib/queue-return";

const LOOKBACK_DAYS = 14;
export type WaitingRow = { id: string; name: string; assigneeName: string | null; since: string | null };

/** Painel /clinic/esperando: quem espera resposta, quem está em atendimento e quantas
 * conversas foram finalizadas hoje. Mesma regra da volta à fila (queue-return.ts). */
export async function getWaitingBoard() {
  const { clinicId, userId } = await requireClinicSession();
  const now = new Date();
  const [clinic, role, conversations, resolvedToday] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { unansweredReturnMinutes: true } }),
    getClinicRole(userId),
    prisma.conversation.findMany({
      where: {
        clinicId,
        status: { in: ["OPEN", "PENDING"] },
        archivedAt: null,
        lastMessageAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000) },
      },
      select: {
        id: true,
        assignedUserId: true,
        aiEnabled: true,
        contact: { select: { name: true } },
        assignedUser: { select: { name: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: 15,
          select: { direction: true, type: true, senderUserId: true, sentFromDevice: true, content: true, createdAt: true },
        },
      },
    }),
    prisma.conversation.count({ where: { clinicId, status: "RESOLVED", resolvedAt: { gte: startOfBrazilDay(now) } } }),
  ]);

  const rows = conversations
    // Com a IA atendendo, quem responde é a IA — não é a equipe que está devendo resposta.
    .filter((c) => !c.aiEnabled)
    .map((c) => ({
      id: c.id,
      name: c.contact.name,
      assignedUserId: c.assignedUserId,
      assigneeName: c.assignedUser?.name ?? null,
      waitingSince: waitingSince([...c.messages].reverse()),
    }));
  const board = groupWaitingBoard(rows);
  const view = (r: (typeof rows)[number]): WaitingRow => ({
    id: r.id,
    name: r.name,
    assigneeName: r.assigneeName,
    since: r.waitingSince?.toISOString() ?? null,
  });
  return {
    returnMinutes: clinic?.unansweredReturnMinutes ?? null,
    canConfigure: can(role, "config"),
    waiting: board.waiting.map(view),
    inService: board.inService.map(view),
    resolvedToday,
  };
}


/** Prazo da volta à fila (gestão). null = desligado. */
export async function setUnansweredReturnMinutes(minutes: number | null) {
  const { clinicId } = await requireClinicPermission("config");
  if (minutes !== null && !(RETURN_MINUTE_OPTIONS as readonly number[]).includes(minutes)) {
    throw new Error("Escolha 15, 30, 60 ou 120 minutos, ou desligado.");
  }
  await prisma.clinic.update({ where: { id: clinicId }, data: { unansweredReturnMinutes: minutes } });
  revalidatePath("/clinic/esperando");
  return { success: true as const };
}
