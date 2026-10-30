import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isCronAuthorized } from "@/lib/request-auth";
import { refreshInstagramToken, shouldRefreshInstagramToken } from "@/lib/instagram-token";

/** Diário (vercel.json): renova o token das contas de Instagram antes de vencer (60 dias).
 * Falha fica no webhook_logs (instagram.token_refresh) — o token antigo segue valendo. */
export async function GET(request: Request) {
  if (!isCronAuthorized(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const accounts = await prisma.instagramAccount.findMany({
    where: { active: true },
    select: { id: true, username: true, accessToken: true, tokenExpiresAt: true, updatedAt: true },
  });
  const results: { username: string | null; status: string }[] = [];
  for (const a of accounts) {
    if (!shouldRefreshInstagramToken(a)) continue;
    const r = await refreshInstagramToken(a.accessToken);
    if (r.ok) {
      await prisma.instagramAccount.update({ where: { id: a.id }, data: { accessToken: r.accessToken, tokenExpiresAt: r.expiresAt } });
      results.push({ username: a.username, status: "renovado" });
    } else {
      await prisma.webhookLog
        .create({ data: { event: "instagram.token_refresh", payload: { username: a.username, error: r.error }, status: "error" } })
        .catch(() => {});
      results.push({ username: a.username, status: `erro: ${r.error}` });
    }
  }
  return NextResponse.json({ checked: accounts.length, results });
}
