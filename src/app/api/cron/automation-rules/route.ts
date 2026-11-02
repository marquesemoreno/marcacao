import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/request-auth";
import { runAutomationRules } from "@/lib/automation-rules-run";

export const maxDuration = 300;

/** Diário 08h (vercel.json): régua automática — ver src/lib/automation-rules-run.ts. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ results: await runAutomationRules() });
}
