import "server-only";
import { prisma } from "@/lib/prisma";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { decideQueueReturn, queueReturnNote } from "@/lib/queue-return";

/** Só olha conversas com movimento recente — as muito antigas já passaram pelo auto-close. */
const LOOKBACK_DAYS = 14;
const MESSAGES_PER_CONVERSATION = 30;

/** Roda a cada 10 min (cron queue-return): tira o dono das conversas atribuídas em que o
 * paciente espera há mais que o prazo da clínica (decideQueueReturn) e deixa uma nota
 * interna dizendo quem não respondeu. */
export async function runQueueReturns(now = new Date()): Promise<{ returned: number }> {
  const clinics = await prisma.clinic.findMany({
    where: { unansweredReturnMinutes: { gt: 0 } },
    select: { id: true, unansweredReturnMinutes: true },
  });
  let returned = 0;
  for (const clinic of clinics) {
    const conversations = await prisma.conversation.findMany({
      where: {
        clinicId: clinic.id,
        assignedUserId: { not: null },
        status: { in: ["OPEN", "PENDING"] },
        archivedAt: null,
        aiEnabled: false,
        lastMessageAt: { gte: new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000) },
      },
      select: {
        id: true,
        assignedUserId: true,
        assignedAt: true,
        status: true,
        aiEnabled: true,
        archivedAt: true,
        assignedUser: { select: { name: true } },
        messages: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
          take: MESSAGES_PER_CONVERSATION,
          select: { direction: true, type: true, senderUserId: true, sentFromDevice: true, content: true, createdAt: true },
        },
      },
    });
    let clinicReturned = 0;
    for (const conv of conversations) {
      const decision = decideQueueReturn({
        now,
        returnMinutes: clinic.unansweredReturnMinutes,
        assignedUserId: conv.assignedUserId,
        assignedAt: conv.assignedAt,
        status: conv.status,
        aiEnabled: conv.aiEnabled,
        archivedAt: conv.archivedAt,
        messages: [...conv.messages].reverse(),
      });
      if (!decision.return) continue;
      // Só tira o dono se ninguém mexeu na conversa desde a leitura acima.
      const updated = await prisma.conversation.updateMany({
        where: { id: conv.id, assignedUserId: conv.assignedUserId },
        data: { assignedUserId: null, assignedAt: null, assignmentSeenAt: null },
      });
      if (updated.count === 0) continue;
      await prisma.message.create({
        data: {
          conversationId: conv.id,
          direction: "OUTBOUND",
          type: "INTERNAL_NOTE",
          content: queueReturnNote(conv.assignedUser?.name ?? "A pessoa atribuída", decision.waitingMinutes),
          status: "SENT",
        },
      });
      clinicReturned++;
    }
    if (clinicReturned > 0) {
      returned += clinicReturned;
      notifyInboxRealtime(clinic.id).catch(() => {});
    }
  }
  return { returned };
}
