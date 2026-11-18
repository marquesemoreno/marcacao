import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/request-auth";
import { runQueueReturns } from "@/lib/queue-return-server";

export const maxDuration = 60;

/** A cada 10 min (vercel.json): conversa atribuída sem resposta volta para a fila. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runQueueReturns();
  return NextResponse.json({ ok: true, ...result });
}
