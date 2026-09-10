import { NextResponse } from "next/server";
import { runLeadOutreachTick } from "@/lib/ai-lead-outreach";

/** Chamado a cada 5min pelo GitHub Actions (ver lead-outreach-dispatch.yml) — não dá
 * pra usar o cron nativo da Vercel aqui porque o plano Hobby recusa cron sub-diário
 * no deploy inteiro do projeto (mesmo motivo do broadcast-dispatch). A frequência
 * dessa chamada não é a frequência do disparo: cada chamada só manda mensagem se já
 * passou do `nextRunAt` guardado (ver runLeadOutreachTick). */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const result = await runLeadOutreachTick();
  return NextResponse.json({ ok: true, ...result });
}
