import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/request-auth";

/** Retenção (auditoria de saúde, 19/10): o log técnico do WhatsApp (webhook_logs) guarda o
 * payload completo das mensagens dos pacientes — mantém só WEBHOOK_LOG_DAYS dias. As
 * conversas em si (messages) não são tocadas. Tentativas de login erradas: 1 dia.
 * Diário (vercel.json), apaga em lotes pra não estourar o tempo da função. */
const WEBHOOK_LOG_DAYS = 60;
const BATCH = 5000;
const MAX_BATCHES = 40;

export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const cutoff = new Date(Date.now() - WEBHOOK_LOG_DAYS * 86_400_000);
  let webhookLogs = 0;
  for (let i = 0; i < MAX_BATCHES; i++) {
    const n = await prisma.$executeRaw`
      DELETE FROM webhook_logs WHERE id IN (
        SELECT id FROM webhook_logs WHERE created_at < ${cutoff} LIMIT ${BATCH}
      )`;
    webhookLogs += n;
    if (n < BATCH) break;
  }
  const loginFailures = await prisma.loginFailure.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 86_400_000) } } });
  return NextResponse.json({ webhookLogs, loginFailures: loginFailures.count });
}
