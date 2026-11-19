import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getClinicSessionOrNull, isClinicManager } from "@/lib/session";
import { cleanAuthCode, INSTAGRAM_SCOPES, OAUTH_NONCE_COOKIE, verifyOAuthState } from "@/lib/instagram-oauth";
import { exchangeInstagramCode, instagramRedirectUri, linkInstagramAccount } from "@/lib/instagram-link";
import { errorSummary } from "@/lib/safe-error";

export const dynamic = "force-dynamic";

/** GET /api/instagram/callback — volta do login comercial do Instagram. Confere o `state`
 * (assinatura, prazo, nonce do cookie e o mesmo usuário/clínica logados), troca o código pelo
 * token de longa duração, inscreve o webhook e grava a conta da clínica. */
export async function GET(request: NextRequest) {
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/clinic/instagram?${q}`, request.url));
    res.cookies.delete({ name: OAUTH_NONCE_COOKIE, path: "/api/instagram" });
    return res;
  };
  const params = request.nextUrl.searchParams;

  // Usuário clicou em "Cancelar" na tela do Instagram.
  if (params.get("error")) return back("ig=cancelado");

  const state = verifyOAuthState(params.get("state"), process.env.NEXTAUTH_SECRET ?? "");
  const nonce = request.cookies.get(OAUTH_NONCE_COOKIE)?.value;
  const session = await getClinicSessionOrNull();
  if (!state || !nonce || state.nonce !== nonce || !session || session.userId !== state.userId || session.clinicId !== state.clinicId) {
    return back("ig=erro&motivo=sessao");
  }
  if (!(await isClinicManager(session.userId))) return back("ig=erro&motivo=gestao");

  const code = cleanAuthCode(params.get("code"));
  if (!code) return back("ig=erro&motivo=codigo");

  try {
    const token = await exchangeInstagramCode(code, instagramRedirectUri(request.nextUrl.origin));
    const missing = INSTAGRAM_SCOPES.filter((s) => !token.permissions.includes(s));
    if (token.permissions.length && missing.length) return back("ig=erro&motivo=permissoes");
    await linkInstagramAccount(state.clinicId, token.accessToken, token.expiresAt);
    revalidatePath("/clinic/instagram");
    return back("ig=ok");
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await prisma.webhookLog
      .create({ data: { event: "instagram.oauth", payload: { clinicId: state.clinicId, error: errorSummary(e) }, status: "ERROR" } })
      .catch(() => null);
    return back(`ig=erro&motivo=meta&detalhe=${encodeURIComponent(message.slice(0, 160))}`);
  }
}
