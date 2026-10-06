import { NextResponse } from "next/server";
import { dispatchNextBatch } from "@/lib/broadcast";
import { dispatchReminderTick } from "@/lib/bridge-reminders";

/** Chamado pelo Vercel Cron a cada minuto (ver vercel.json) — a Vercel autentica cron
 * jobs mandando esse header com o valor de CRON_SECRET automaticamente. */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Lembrete primeiro (pode ceder a vez à campanha — ver dispatchReminderTick), depois
  // campanhas; o intervalo único por clínica impede que os dois saiam no mesmo minuto.
  const reminders = await dispatchReminderTick();
  const result = await dispatchNextBatch();
  return NextResponse.json({ ok: true, reminders: reminders.sent, ...result });
}
