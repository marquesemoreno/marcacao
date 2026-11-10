import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/request-auth";
import { sendMetaConversions, syncAdConversions } from "@/lib/ad-conversions-server";

export const maxDuration = 120;

/** De hora em hora (vercel.json): grava agendou/compareceu dos leads que vieram de clique
 * pago (ref: do site) e manda os novos à Meta. O Google Ads busca a planilha sozinho
 * (/api/conversions/google-ads). Ver src/lib/ad-tracking.ts. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const sync = await syncAdConversions();
  let meta: unknown;
  try {
    meta = await sendMetaConversions();
  } catch (error) {
    console.error("Falha ao enviar conversões à Meta:", error instanceof Error ? error.message : error);
    meta = { error: "falha" };
  }
  return NextResponse.json({ sync, meta });
}
