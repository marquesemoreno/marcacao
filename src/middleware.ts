import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { AFFILIATE_REF_COOKIE, AFFILIATE_REF_COOKIE_MAX_AGE } from "@/lib/affiliate";

export default withAuth(
  function middleware(req) {
    const { pathname, searchParams } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/entrar", req.url));
    }
    if (pathname.startsWith("/clinic") && role !== "CLINIC") {
      return NextResponse.redirect(new URL("/entrar", req.url));
    }

    const response = NextResponse.next();

    // Tracking de afiliados: ?ref=CODIGO em qualquer página pública vira
    // cookie de 30 dias, lido depois em createAppointment (ver docs/obsidian/13).
    const ref = searchParams.get("ref");
    if (ref) {
      response.cookies.set(AFFILIATE_REF_COOKIE, ref, {
        maxAge: AFFILIATE_REF_COOKIE_MAX_AGE,
        path: "/",
        sameSite: "lax",
      });
    }

    return response;
  },
  {
    callbacks: {
      // Só exige sessão para as rotas protegidas — nas demais (incluindo
      // páginas públicas com ?ref=), deixa passar pra rodar o tracking acima.
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        if (pathname.startsWith("/admin") || pathname.startsWith("/clinic")) {
          return !!token;
        }
        return true;
      },
    },
    pages: { signIn: "/entrar" },
  }
);

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon.svg).*)"],
};
