import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildGoogleAdsCsv } from "@/lib/ad-tracking";
import { googleConversionName, type ConversionKind } from "@/lib/ad-conversions-server";

/**
 * Planilha de conversões offline para o Google Ads ("Uploads programados" → HTTPS, com
 * usuário e senha). Só gclid + nome genérico da conversão + hora — nada clínico. Lista as
 * conversões dos últimos 60 dias; o Google ignora linhas já importadas (mesmo gclid, nome
 * e hora). Credenciais: GOOGLE_ADS_FEED_USER / GOOGLE_ADS_FEED_PASSWORD (sem elas, 404).
 */

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function GET(request: Request) {
  const user = process.env.GOOGLE_ADS_FEED_USER;
  const pass = process.env.GOOGLE_ADS_FEED_PASSWORD;
  if (!user || !pass) return new Response("Not found", { status: 404 });

  const auth = request.headers.get("authorization") ?? "";
  const decoded = auth.startsWith("Basic ") ? Buffer.from(auth.slice(6), "base64").toString() : "";
  const sep = decoded.indexOf(":");
  if (sep < 0 || !safeEqual(decoded.slice(0, sep), user) || !safeEqual(decoded.slice(sep + 1), pass)) {
    return new Response("Unauthorized", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="conversoes"' } });
  }

  const conversions = await prisma.adConversion.findMany({
    where: { occurredAt: { gte: new Date(Date.now() - 60 * 86_400_000) }, adClick: { gclid: { not: null } } },
    select: { kind: true, occurredAt: true, adClick: { select: { gclid: true } } },
    orderBy: { occurredAt: "asc" },
  });
  const csv = buildGoogleAdsCsv(
    conversions.map((c) => ({
      gclid: c.adClick.gclid!,
      conversionName: googleConversionName(c.kind as ConversionKind),
      occurredAt: c.occurredAt,
    })),
  );
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="conversoes-google-ads.csv"',
      "Cache-Control": "no-store",
    },
  });
}
