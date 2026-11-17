import type { AuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { isIpLocked, isLoginLocked, LOGIN_WINDOW_MIN, SESSION_MAX_AGE_SEC } from "@/lib/login-guard";
import { requiresTwoFactor, TWO_FACTOR_INVALID, TWO_FACTOR_REQUIRED } from "@/lib/auth-security";
import { verifyTotp } from "@/lib/totp";
import { decryptToken } from "@/lib/token-crypto";

type ReqLike = { headers?: Record<string, string | string[] | undefined> } | undefined;
const header = (req: ReqLike, name: string) => {
  const v = req?.headers?.[name];
  return (Array.isArray(v) ? v[0] : v) ?? null;
};

const clientIp = (req: ReqLike) => header(req, "x-forwarded-for")?.split(",")[0].trim().slice(0, 64) || null;

/** Hash de uma senha qualquer, calculado uma vez: quando o e-mail não existe, compara contra
 * ele para a resposta demorar o mesmo que a de um e-mail real (não dá para descobrir
 * quais e-mails têm cadastro medindo o tempo). */
let dummyHash: string | null = null;
const timingDummyHash = () => (dummyHash ??= bcrypt.hashSync("senha-que-nao-existe", 10));

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
        ip: clientIp(req),
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

        // Mesma origem errando muito (senha ou código), em qualquer e-mail: bloqueia a origem.
        const ip = clientIp(req);
        if (ip) {
          const fromIp = await prisma.loginEvent
            .count({
              where: { ip, success: false, reason: { in: ["SENHA", "CODIGO_2FA"] }, createdAt: { gte: new Date(Date.now() - LOGIN_WINDOW_MIN * 60_000) } },
            })
            .catch(() => 0);
          if (isIpLocked(fromIp)) {
            await logLogin(req, { email, success: false, reason: "BLOQUEADO_IP" });
            return null;
          }
        }

        // E-mail sem diferenciar maiúscula (cadastros antigos podem ter maiúscula salva).
        const user = await prisma.user.findFirst({
          where: { email: { equals: email, mode: "insensitive" } },
        });
        const passwordMatches = user
          ? await bcrypt.compare(credentials.password, user.passwordHash)
          : (await bcrypt.compare(credentials.password, timingDummyHash()), false);
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
