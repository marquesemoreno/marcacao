import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyInboxRealtime } from "@/lib/supabase-server";
import { NO_RESPONSE_TAG } from "@/lib/conversation-tags";

const STALE_HOURS = 24;

/** Marca com "sem retorno" conversas onde já mandamos a última mensagem há mais de
 * STALE_HOURS e o paciente não respondeu — some sozinha assim que ele responde (ver
 * webhook route.ts). Chamado de hora em hora pelo Vercel Cron (ver vercel.json) —
 * mesma autenticação dos outros crons (CRON_SECRET). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  const candidates = await prisma.conversation.findMany({
    where: {
      status: "OPEN",
      lastMessageAt: { lt: cutoff },
      NOT: { tags: { has: NO_RESPONSE_TAG } },
    },
    select: {
      id: true,
      clinicId: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { direction: true } },
    },
  });

  // Só marca quando a ÚLTIMA mensagem foi NOSSA (OUTBOUND) — se foi do paciente,
  // somos nós que estamos devendo resposta, não ele.
  const staleConversationIds = candidates
    .filter((c) => c.messages[0]?.direction === "OUTBOUND")
    .map((c) => c.id);

  for (const id of staleConversationIds) {
    await prisma.conversation.update({
      where: { id },
      data: { tags: { push: NO_RESPONSE_TAG } },
    });
  }

  const affectedClinics = new Set(
    candidates.filter((c) => staleConversationIds.includes(c.id)).map((c) => c.clinicId)
  );
  for (const clinicId of affectedClinics) {
    notifyInboxRealtime(clinicId).catch(() => {});
  }

  return NextResponse.json({ ok: true, tagged: staleConversationIds.length });
}
