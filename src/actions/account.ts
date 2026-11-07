"use server";

import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hashResetToken, newResetToken, passwordProblem, resetTokenStatus } from "@/lib/auth-security";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { sendEmailViaResend } from "@/lib/resend";

async function me() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Não autorizado.");
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.active || user.sessionVersion !== (session.user.sessionVersion ?? 0)) throw new Error("Não autorizado.");
  return user;
}

/** Troca a própria senha (clínica ou admin) — exige a senha atual. Derruba as sessões dos
 * outros aparelhos; a tela chama update() do NextAuth para manter esta. */
export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const user = await me();
  const problem = passwordProblem(newPassword);
  if (problem) throw new Error(problem);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash))) throw new Error("Senha atual incorreta.");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash, sessionVersion: { increment: 1 } } });
  return { success: true as const };
}

/** "Sair de todos os outros aparelhos". */
export async function endMyOtherSessions() {
  const user = await me();
  await prisma.user.update({ where: { id: user.id }, data: { sessionVersion: { increment: 1 } } });
  return { success: true as const };
}

export async function getMySecurity() {
  const user = await me();
  const logins = await prisma.loginEvent.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: { createdAt: true, success: true, reason: true, ip: true, userAgent: true },
  });
  return { twoFactor: !!user.totpEnabledAt, email: user.email, logins };
}

/** Começa a ativação do 2FA: gera o segredo (guardado criptografado, ainda sem valer). */
export async function startTwoFactorSetup() {
  const user = await me();
  if (user.totpEnabledAt) throw new Error("A verificação em duas etapas já está ativa.");
  const secret = generateTotpSecret();
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: encryptToken(secret), totpEnabledAt: null } });
  return { secret, uri: totpUri(secret, user.email) };
}

/** Confirma com o 1º código do app — só então o 2FA passa a ser pedido no login. */
export async function confirmTwoFactorSetup(code: string) {
  const user = await me();
  if (!user.totpSecret) throw new Error("Comece a ativação de novo.");
  if (!verifyTotp(decryptToken(user.totpSecret), code)) throw new Error("Código não confere. Veja o horário do celular e tente o código atual.");
  await prisma.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date() } });
  return { success: true as const };
}

export async function disableTwoFactor(password: string) {
  const user = await me();
  if (!(await bcrypt.compare(password, user.passwordHash))) throw new Error("Senha incorreta.");
  await prisma.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null } });
  return { success: true as const };
}

const APP_URL = () => (process.env.NEXTAUTH_URL || "https://www.conectasaudevc.com.br").replace(/\/$/, "");

/** "Esqueci a senha" (público). Sempre responde igual — não revela se o e-mail existe. */
export async function requestPasswordReset(emailInput: string) {
  const email = String(emailInput ?? "").trim().toLowerCase();
  const generic = { success: true as const };
  if (!/^\S+@\S+\.\S+$/.test(email)) return generic;
  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" }, active: true } });
  if (!user) return generic;
  // No máximo 3 pedidos por hora por usuário.
  const recent = await prisma.passwordResetToken.count({ where: { userId: user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } } });
  if (recent >= 3) return generic;
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.BROADCAST_EMAIL_FROM;
  if (!apiKey || !from) return generic;

  const t = newResetToken();
  await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash: t.hash, expiresAt: t.expiresAt } });
  const link = `${APP_URL()}/redefinir-senha?token=${t.token}`;
  const first = user.name.split(" ")[0];
  await sendEmailViaResend({
    apiKey,
    from,
    to: user.email,
    subject: "Redefinir sua senha do Conecta Saúde",
    text: `Olá, ${first}.\n\nPara criar uma senha nova, abra o link abaixo (vale por 1 hora e só uma vez):\n${link}\n\nSe não foi você que pediu, ignore este e-mail — sua senha continua a mesma.`,
    html: `<p>Olá, ${first}.</p><p>Para criar uma senha nova, clique no botão abaixo. O link vale por 1 hora e só uma vez.</p><p><a href="${link}" style="display:inline-block;background:#059669;color:#fff;padding:10px 18px;border-radius:999px;text-decoration:none">Criar senha nova</a></p><p style="color:#86868b;font-size:13px">Se não foi você que pediu, ignore este e-mail — sua senha continua a mesma.</p>`,
  });
  return generic;
}

export async function checkResetToken(token: string) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(String(token ?? "")) } });
  return resetTokenStatus(row);
}

/** Usa o link: grava a senha nova, queima o token e derruba todas as sessões. */
export async function resetPasswordWithToken(token: string, newPassword: string) {
  const problem = passwordProblem(newPassword);
  if (problem) throw new Error(problem);
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashResetToken(String(token ?? "")) } });
  const status = resetTokenStatus(row);
  if (status !== "ok" || !row) throw new Error(status === "expired" ? "O link venceu. Peça outro." : "Link inválido ou já usado. Peça outro.");
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.$transaction([
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
    prisma.user.update({ where: { id: row.userId }, data: { passwordHash, sessionVersion: { increment: 1 } } }),
    prisma.loginFailure.deleteMany({ where: { email: (await prisma.user.findUniqueOrThrow({ where: { id: row.userId } })).email.toLowerCase() } }),
  ]);
  return { success: true as const };
}
