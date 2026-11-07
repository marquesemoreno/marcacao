/** Regras puras do login mais seguro (07/11/2026): token de "esqueci a senha", força da
 * senha nova, revogação de sessão por versão e quando pedir o código de 2 etapas. */
import { createHash, randomBytes } from "node:crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60_000;
export const PASSWORD_MIN = 8;
/** Erros do login que a tela /entrar entende (NextAuth devolve a mensagem em `error`). */
export const TWO_FACTOR_REQUIRED = "2FA_REQUIRED";
export const TWO_FACTOR_INVALID = "2FA_INVALID";

export function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newResetToken(now: Date = new Date()) {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashResetToken(token), expiresAt: new Date(now.getTime() + RESET_TOKEN_TTL_MS) };
}

export function resetTokenStatus(
  row: { expiresAt: Date; usedAt: Date | null } | null,
  now: Date = new Date()
): "ok" | "expired" | "used" | "invalid" {
  if (!row) return "invalid";
  if (row.usedAt) return "used";
  if (row.expiresAt.getTime() <= now.getTime()) return "expired";
  return "ok";
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `A senha precisa ter pelo menos ${PASSWORD_MIN} caracteres.`;
  if (!/[A-Za-zÀ-ÿ]/.test(pw)) return "A senha precisa ter pelo menos uma letra.";
  if (!/\d/.test(pw)) return "A senha precisa ter pelo menos um número.";
  return null;
}

export function sessionStillValid(
  tokenVersion: number | undefined,
  user: { active: boolean; sessionVersion: number } | null
): boolean {
  if (!user || !user.active) return false;
  return (tokenVersion ?? 0) === user.sessionVersion;
}

export function requiresTwoFactor(user: { totpSecret: string | null; totpEnabledAt: Date | null }): boolean {
  return !!user.totpSecret && !!user.totpEnabledAt;
}
