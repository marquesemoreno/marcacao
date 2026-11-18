import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/request-auth";
import { runMissedCallRecoveries } from "@/lib/missed-call-server";

export const maxDuration = 60;

/** A cada minuto (vercel.json): ligação perdida pelo WhatsApp recebe mensagem ou vira tarefa. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runMissedCallRecoveries();
  return NextResponse.json({ ok: true, ...result });
}
