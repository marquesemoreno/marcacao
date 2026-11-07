/** Verificação em duas etapas por app autenticador (Google Authenticator, Microsoft
 * Authenticator…): TOTP do RFC 6238 com SHA-1, 6 dígitos, passo de 30 s. Sem dependência
 * externa — só node:crypto. Testado com os vetores oficiais. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const ISSUER = "Conecta Saúde";
const STEP_MS = 30_000;

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | ALPHABET.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/** 20 bytes aleatórios = 32 caracteres base32. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpAt(secret: string, timeMs: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(timeMs / STEP_MS)));
  const hmac = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return String(code).padStart(6, "0");
}

/** Aceita um passo antes e um depois (relógio do celular levemente fora). */
export function verifyTotp(secret: string, input: string, nowMs: number = Date.now()): boolean {
  const code = String(input ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return false;
  return [-1, 0, 1].some((w) => timingSafeEqual(Buffer.from(totpAt(secret, nowMs + w * STEP_MS)), Buffer.from(code)));
}

export function totpUri(secret: string, account: string): string {
  const label = `${encodeURIComponent(ISSUER)}:${encodeURIComponent(account)}`;
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(ISSUER)}&algorithm=SHA1&digits=6&period=30`;
}
