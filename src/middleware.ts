import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { AFFILIATE_REF_COOKIE, AFFILIATE_REF_COOKIE_MAX_AGE } from "@/lib/affiliate";

export default withAuth(
  function middleware(req) {
    const { pathname, searchParams } = req.nextUrl;
    const role = req.nextauth.token?.role;

    const isAdminRoute = pathname.startsWith("/admin");
    const isClinicRoute = (pathname === "/clinic" || pathname.startsWith("/clinic/")) && !pathname.startsWith("/clinicas");

    if (isAdminRoute && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/clinic/inbox", req.url));
    }
    if (isClinicRoute && role !== "CLINIC" && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/entrar", req.url));
    }

    // Usuário da clínica já logado batendo na home ou na tela de login: manda
    // direto pro inbox (é a rotina de trabalho dele, não faz sentido ver a
    // landing page do marketplace nem o formulário de login de novo).
    const isEntryRoute = pathname === "/" || pathname === "/entrar";
    if (isEntryRoute && role === "CLINIC") {
      return NextResponse.redirect(new URL("/clinic/inbox", req.url));
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
      // páginas públicas como /clinicas, /procedimentos, /buscar com ?ref=), deixa passar.
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        const isAdminRoute = pathname.startsWith("/admin");
        const isClinicRoute = (pathname === "/clinic" || pathname.startsWith("/clinic/")) && !pathname.startsWith("/clinicas");

        if (isAdminRoute || isClinicRoute) {
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
