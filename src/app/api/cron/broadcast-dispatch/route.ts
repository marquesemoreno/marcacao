import { NextResponse } from "next/server";
import { dispatchNextBatch } from "@/lib/broadcast";

/** Chamado pelo Vercel Cron a cada minuto (ver vercel.json) — a Vercel autentica cron
 * jobs mandando esse header com o valor de CRON_SECRET automaticamente. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await dispatchNextBatch();
  return NextResponse.json({ ok: true, ...result });
}
