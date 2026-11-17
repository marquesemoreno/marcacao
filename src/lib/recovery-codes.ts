import { createHash, randomInt } from "node:crypto";

/** Códigos de reserva do 2FA (auditoria B3): para entrar quando o celular do app autenticador
 * se perdeu. Mostrados uma vez; no banco só o SHA-256; cada um vale uma vez. Puro — sem banco. */
export const RECOVERY_CODE_COUNT = 10;
// Sem 0/o, 1/l/i: o código é lido de papel.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function normalize(input: string): string {
  return String(input ?? "").toLowerCase().replace(/[\s-]/g, "");
}

/** "abcd-efgh" com 8 letras/números (≈ 40 bits cada). */
export function isRecoveryCodeFormat(input: string): boolean {
  return new RegExp(`^[${ALPHABET}]{8}$`).test(normalize(input));
}

export function hashRecoveryCode(input: string): string {
  return createHash("sha256").update(`recovery:${normalize(input)}`).digest("hex");
}

export function generateRecoveryCodes(count = RECOVERY_CODE_COUNT): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => {
    const raw = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    return `${raw.slice(0, 4)}-${raw.slice(4)}`;
  });
  return { codes, hashes: codes.map(hashRecoveryCode) };
}
