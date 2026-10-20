import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLoginLocked, LOGIN_WINDOW_MIN, SESSION_MAX_AGE_SEC } from "@/lib/login-guard";

export const authOptions: AuthOptions = {
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE_SEC },
  jwt: { maxAge: SESSION_MAX_AGE_SEC },
  pages: { signIn: "/entrar" },
  providers: [
    CredentialsProvider({
      name: "Credenciais",
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.trim().toLowerCase();

        // 5 senhas erradas em 15 min bloqueiam o e-mail até a janela passar.
        const failures = await prisma.loginFailure.findMany({
          where: { email, createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MIN * 60_000) } },
          select: { createdAt: true },
        });
        if (isLoginLocked(failures.map((f) => f.createdAt))) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });
        const passwordMatches = user ? await bcrypt.compare(credentials.password, user.passwordHash) : false;
        if (!user || !passwordMatches) {
          await prisma.loginFailure.create({ data: { email } }).catch(() => {});
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clinicId = user.clinicId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.clinicId = token.clinicId;
      }
      return session;
    },
  },
};
