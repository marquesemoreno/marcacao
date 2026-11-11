import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/request-auth";
import { runTagAutomations } from "@/lib/tag-automations-run";

export const maxDuration = 300;

/** A cada 10 min (vercel.json): automações por tag — ver src/lib/tag-automations-run.ts. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ results: await runTagAutomations() });
}
