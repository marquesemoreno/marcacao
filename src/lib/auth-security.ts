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

/** Valor de TWO_FACTOR_ENFORCE que liga a exigência ("1" ou "true"). Desligado por padrão:
 * ligar na Vercel só depois de avisar admin e gestão para ativarem em Minha conta. */
export function isTwoFactorEnforced(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true";
}

/** 2FA obrigatório para quem enxerga mais (auditoria de segurança 16/11/2026, M10): admin da
 * TIVDC (todas as clínicas) e gestão da clínica (relatórios, configurações, acessos).
 * Devolve para onde mandar quem ainda não ativou — a tela Minha conta, onde ativa sozinho —
 * ou null se pode seguir. Na própria tela de ativar não redireciona; sem saber a página
 * atual também não (melhor deixar passar do que prender em laço). */
export function twoFactorSetupRedirect(
  user: { role: string; clinicRole: string | null; totpSecret: string | null; totpEnabledAt: Date | null },
  pathname: string | null,
  enforce: boolean,
): string | null {
  if (!enforce || !pathname || requiresTwoFactor(user)) return null;
  const setupPath = user.role === "ADMIN" ? "/admin/conta" : user.role === "CLINIC" && user.clinicRole === "GESTAO" ? "/clinic/perfil" : null;
  if (!setupPath || pathname === setupPath || pathname.startsWith(`${setupPath}/`)) return null;
  return `${setupPath}?2fa=obrigatorio`;
}
