import { NextResponse } from "next/server";
import { runLeadOutreachTick } from "@/lib/ai-lead-outreach";

/** Chamado 1x/minuto pelo Vercel Cron (ver vercel.json) — a Vercel autentica cron
 * jobs mandando esse header com o valor de CRON_SECRET automaticamente. A
 * frequência do cron não é a frequência do disparo: cada chamada só manda
 * mensagem se já passou do `nextRunAt` guardado (ver runLeadOutreachTick). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runLeadOutreachTick();
  return NextResponse.json({ ok: true, ...result });
}
