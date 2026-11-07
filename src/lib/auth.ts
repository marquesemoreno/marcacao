import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isLoginLocked, LOGIN_WINDOW_MIN, SESSION_MAX_AGE_SEC } from "@/lib/login-guard";
import { requiresTwoFactor, TWO_FACTOR_INVALID, TWO_FACTOR_REQUIRED } from "@/lib/auth-security";
import { verifyTotp } from "@/lib/totp";
import { decryptToken } from "@/lib/token-crypto";

type ReqLike = { headers?: Record<string, string | string[] | undefined> } | undefined;
const header = (req: ReqLike, name: string) => {
  const v = req?.headers?.[name];
  return (Array.isArray(v) ? v[0] : v) ?? null;
};

/** Histórico de entradas (login certo e errado) — nunca derruba o login se falhar. */
async function logLogin(
  req: ReqLike,
  data: { email: string; success: boolean; reason?: string; userId?: string; clinicId?: string | null }
) {
  await prisma.loginEvent
    .create({
      data: {
        ...data,
        clinicId: data.clinicId ?? null,
        ip: header(req, "x-forwarded-for")?.split(",")[0].trim().slice(0, 64) ?? null,
        userAgent: header(req, "user-agent")?.slice(0, 300) ?? null,
      },
    })
    .catch(() => {});
}

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
        code: { label: "Código", type: "text" },
      },
      async authorize(credentials, req) {
        if (!credentials?.email || !credentials.password) return null;
        const email = credentials.email.trim().toLowerCase();

        // 5 erros (senha ou código) em 15 min bloqueiam o e-mail até a janela passar.
        const failures = await prisma.loginFailure.findMany({
          where: { email, createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MIN * 60_000) } },
          select: { createdAt: true },
        });
        if (isLoginLocked(failures.map((f) => f.createdAt))) {
          await logLogin(req, { email, success: false, reason: "BLOQUEADO" });
          return null;
        }

        // E-mail sem diferenciar maiúscula (cadastros antigos podem ter maiúscula salva).
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        const passwordMatches = user ? await bcrypt.compare(credentials.password, user.passwordHash) : false;
        if (!user || !passwordMatches) {
          await prisma.loginFailure.create({ data: { email } }).catch(() => {});
          await logLogin(req, { email, success: false, reason: "SENHA", userId: user?.id, clinicId: user?.clinicId });
          return null;
        }
        // Usuário desativado não entra (antes só sumia das listas).
        if (!user.active) {
          await logLogin(req, { email, success: false, reason: "INATIVO", userId: user.id, clinicId: user.clinicId });
          return null;
        }

        // Verificação em duas etapas: senha certa, falta o código do app autenticador.
        if (requiresTwoFactor(user)) {
          const code = credentials.code?.trim();
          if (!code) throw new Error(TWO_FACTOR_REQUIRED);
          if (!verifyTotp(decryptToken(user.totpSecret!), code)) {
            await prisma.loginFailure.create({ data: { email } }).catch(() => {});
            await logLogin(req, { email, success: false, reason: "CODIGO_2FA", userId: user.id, clinicId: user.clinicId });
            throw new Error(TWO_FACTOR_INVALID);
          }
        }

        await logLogin(req, { email, success: true, userId: user.id, clinicId: user.clinicId });
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          clinicId: user.clinicId,
          isDoctor: user.clinicRole === "MEDICO",
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      // update() da tela (troca de senha / sair dos outros aparelhos): relê a versão no banco.
      if (trigger === "update" && token.sub) {
        const fresh = await prisma.user.findUnique({ where: { id: token.sub }, select: { sessionVersion: true } });
        if (fresh) token.sessionVersion = fresh.sessionVersion;
      }
      if (user) {
        token.role = user.role;
        token.clinicId = user.clinicId;
        token.isDoctor = !!user.isDoctor;
        token.sessionVersion = user.sessionVersion ?? 0;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role;
        session.user.clinicId = token.clinicId;
        session.user.sessionVersion = token.sessionVersion ?? 0;
      }
      return session;
    },
  },
};
