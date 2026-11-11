import { errorSummary } from "@/lib/safe-error";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MAX_CLICK_BODY_BYTES, parseClickPayload } from "@/lib/ad-tracking";

/**
 * Recebe o clique pago do site da clínica (track.js → navigator.sendBeacon), só depois do
 * "Aceitar" dos cookies e só quando a visita tem gclid/gbraid/wbraid/fbclid. Público, mas:
 * - CORS só para os sites cadastrados em TRACK_CLICK_ORIGINS (padrão: site da Urolaser);
 * - corpo de no máximo 2 KB, validado campo a campo (ver parseClickPayload);
 * - limite por visitante (hash do IP, nunca gravado) e por instância;
 * - grava só token → identificadores de clique + utm_*. Sem IP, sem página, sem referrer.
 * Responde 204 sempre que aceitou (o beacon não lê a resposta).
 */

const DEFAULT_ORIGINS = ["https://www.urolaservca.com.br"];

function allowedOrigins(): string[] {
  const env = process.env.TRACK_CLICK_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean);
  return env?.length ? env : DEFAULT_ORIGINS;
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

// Limite em memória (por instância da função): 20 cliques por visitante a cada 10 min e
// 600 por minuto no total. Suficiente contra abuso casual; o token é único no banco.
const PER_VISITOR = 20;
const VISITOR_WINDOW_MS = 10 * 60_000;
const GLOBAL_PER_MINUTE = 600;
const visitors = new Map<string, number[]>();
let globalWindow = { start: 0, count: 0 };

function visitorKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "?";
  return createHash("sha256").update(`${ip}|${new Date().toISOString().slice(0, 10)}`).digest("hex").slice(0, 16);
}

function rateLimited(key: string, now = Date.now()): boolean {
  if (now - globalWindow.start > 60_000) globalWindow = { start: now, count: 0 };
  if (++globalWindow.count > GLOBAL_PER_MINUTE) return true;
  const hits = (visitors.get(key) ?? []).filter((t) => now - t < VISITOR_WINDOW_MS);
  hits.push(now);
  visitors.set(key, hits);
  if (visitors.size > 5000) visitors.clear();
  return hits.length > PER_VISITOR;
}

export async function OPTIONS(request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));
  return new NextResponse(null, { status: headers["Access-Control-Allow-Origin"] ? 204 : 403, headers });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (!headers["Access-Control-Allow-Origin"]) return new NextResponse(null, { status: 403 });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_CLICK_BODY_BYTES) return new NextResponse(null, { status: 413, headers });
  if (rateLimited(visitorKey(request))) return new NextResponse(null, { status: 429, headers });

  // sendBeacon pode mandar application/json ou text/plain — lê como texto nos dois casos.
  const raw = await request.text();
  if (raw.length > MAX_CLICK_BODY_BYTES) return new NextResponse(null, { status: 413, headers });
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new NextResponse(null, { status: 400, headers });
  }
  const click = parseClickPayload(body);
  if (!click) return new NextResponse(null, { status: 400, headers });

  try {
    // Token repetido (mesma visita recarregando) não sobrescreve o primeiro registro.
    await prisma.adClick.upsert({ where: { token: click.token }, create: click, update: {} });
  } catch (error) {
    console.error("Falha ao gravar clique de anúncio:", errorSummary(error));
    return new NextResponse(null, { status: 500, headers });
  }
  return new NextResponse(null, { status: 204, headers });
}
