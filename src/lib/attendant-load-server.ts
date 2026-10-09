import "server-only";
import { prisma } from "@/lib/prisma";
import { attendantLoadLevel, countAwaitingReply, type AttendantLoadLevel } from "@/lib/attendant-load";

export type AttendantLoad = { awaiting: number; level: AttendantLoadLevel };

/** Conversas abertas do atendente esperando resposta dele agora (ver attendant-load.ts). */
export async function getAttendantLoad(userId: string): Promise<AttendantLoad> {
  const open = await prisma.conversation.findMany({
    where: { assignedUserId: userId, status: { in: ["OPEN", "PENDING"] }, archivedAt: null },
    select: {
      messages: {
        where: { type: { not: "INTERNAL_NOTE" }, deletedAt: null },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { direction: true },
      },
    },
  });
  const awaiting = countAwaitingReply(open.map((c) => c.messages[0]?.direction));
  return { awaiting, level: attendantLoadLevel(awaiting) };
}
