import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const { pathname } = req.nextUrl;
    const role = req.nextauth.token?.role;

    if (pathname.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/entrar", req.url));
    }
    if (pathname.startsWith("/clinic") && role !== "CLINIC") {
      return NextResponse.redirect(new URL("/entrar", req.url));
    }
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token }) => !!token,
    },
    pages: { signIn: "/entrar" },
  }
);

export const config = {
  matcher: ["/admin/:path*", "/clinic/:path*"],
};
