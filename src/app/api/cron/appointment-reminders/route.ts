import { NextResponse } from "next/server";
import { dispatchReminderTick } from "@/lib/bridge-reminders";

/** Chamado 1x/dia pelo Vercel Cron (ver vercel.json) — a Vercel autentica cron
 * jobs mandando esse header com o valor de CRON_SECRET automaticamente. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Não dispara mais a agenda inteira de uma vez: os lembretes saem um por vez pelo
  // cron de broadcast-dispatch (dispatchReminderTick). Chamar aqui manda no máximo 1.
  const result = await dispatchReminderTick();
  return NextResponse.json({ ok: true, ...result });
}
