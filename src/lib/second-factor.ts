import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import { matchTotpStep } from "@/lib/totp";
import { hashRecoveryCode, isRecoveryCodeFormat } from "@/lib/recovery-codes";

/** Confere o 2º fator do login e o "gasta" (auditoria de segurança 16/11/2026, B3):
 * - código do app: só vale se o passo for mais novo que o último aceito — quem viu o código
 *   por cima do ombro não reusa dentro da janela de ±30 s;
 * - código de reserva: vale uma vez e sai da lista.
 * As gravações são condicionais (updateMany com a condição no where): dois logins ao mesmo
 * tempo com o mesmo código, só um passa. */
export async function consumeSecondFactor(
  user: { id: string; totpSecret: string | null; totpLastStep: number | null; totpRecoveryCodes: string[] },
  input: string,
  nowMs: number = Date.now(),
): Promise<"TOTP" | "RECOVERY" | null> {
  if (!user.totpSecret) return null;

  const step = matchTotpStep(decryptToken(user.totpSecret), input, nowMs);
  if (step !== null) {
    if (user.totpLastStep !== null && step <= user.totpLastStep) return null;
    const res = await prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    return res.count === 1 ? "TOTP" : null;
  }

  if (isRecoveryCodeFormat(input)) {
    const hash = hashRecoveryCode(input);
    if (!user.totpRecoveryCodes.includes(hash)) return null;
    const res = await prisma.user.updateMany({
      where: { id: user.id, totpRecoveryCodes: { has: hash } },
      data: { totpRecoveryCodes: { set: user.totpRecoveryCodes.filter((h) => h !== hash) } },
    });
    return res.count === 1 ? "RECOVERY" : null;
  }
  return null;
}
