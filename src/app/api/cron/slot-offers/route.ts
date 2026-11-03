import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/request-auth";
import { processSlotOffers } from "@/lib/slot-offer-server";

/** A cada 5 min (vercel.json): oferta de vaga sem resposta no prazo passa pro próximo da
 * lista de espera; as que esperavam o horário (07–20h) saem. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await processSlotOffers());
}
