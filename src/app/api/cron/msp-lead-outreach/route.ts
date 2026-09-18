import { NextResponse } from "next/server";
import { runMspOutreachTick } from "@/lib/msp-lead-outreach";

/** Chamado a cada 5min pelo GitHub Actions (ver lead-outreach-dispatch.yml — mesmo
 * workflow que já dispara /api/cron/lead-outreach, plano Hobby da Vercel não aceita
 * cron sub-diário). A frequência dessa chamada não é a frequência do disparo: cada
 * chamada só manda mensagem se já passou do `nextRunAt` guardado. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runMspOutreachTick();
  return NextResponse.json({ ok: true, ...result });
}
