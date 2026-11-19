import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getClinicSessionOrNull, isClinicManager } from "@/lib/session";
import { isDemoClinicCnpj } from "@/lib/demo-clinic";
import { buildInstagramAuthorizeUrl, OAUTH_NONCE_COOKIE, OAUTH_STATE_MAX_AGE_MS, signOAuthState } from "@/lib/instagram-oauth";
import { instagramRedirectUri } from "@/lib/instagram-link";

export const dynamic = "force-dynamic";

/** GET /api/instagram/connect — botão "Conectar Instagram" (gestão). Leva ao login comercial do
 * Instagram com um `state` assinado (clínica + usuário + nonce do cookie); a volta é em
 * /api/instagram/callback. */
export async function GET(request: Request) {
  const back = (q: string) => NextResponse.redirect(new URL(`/clinic/instagram?${q}`, request.url));
  const session = await getClinicSessionOrNull();
  if (!session) return NextResponse.redirect(new URL("/entrar", request.url));
  if (!(await isClinicManager(session.userId))) return back("ig=erro&motivo=gestao");

  const clinic = await prisma.clinic.findUnique({ where: { id: session.clinicId }, select: { cnpj: true } });
  if (isDemoClinicCnpj(clinic?.cnpj)) return back("ig=demo");

  const appId = process.env.INSTAGRAM_APP_ID;
  const secret = process.env.NEXTAUTH_SECRET;
  if (!appId || !secret || !process.env.INSTAGRAM_APP_SECRET) return back("ig=erro&motivo=config");

  const nonce = randomBytes(16).toString("base64url");
  const state = signOAuthState({ clinicId: session.clinicId, userId: session.userId, nonce, issuedAt: Date.now() }, secret);
  const res = NextResponse.redirect(buildInstagramAuthorizeUrl({ appId, redirectUri: instagramRedirectUri(new URL(request.url).origin), state }));
  res.cookies.set(OAUTH_NONCE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/instagram",
    maxAge: OAUTH_STATE_MAX_AGE_MS / 1000,
  });
  return res;
}
