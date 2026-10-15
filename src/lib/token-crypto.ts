import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/** Criptografia em repouso dos tokens da API oficial do WhatsApp (AES-256-GCM). Chave em
 * WHATSAPP_TOKEN_ENCRYPTION_KEY (32 bytes em base64: `openssl rand -base64 32`). Formato
 * "enc:v1:<iv>:<tag>:<dados>" (base64). Valor sem o prefixo = token antigo em texto puro,
 * devolvido como está (a próxima reconexão grava criptografado). */
const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.WHATSAPP_TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY não configurada");
  const k = Buffer.from(raw, "base64");
  if (k.length !== 32) throw new Error("WHATSAPP_TOKEN_ENCRYPTION_KEY precisa ter 32 bytes (base64)");
  return k;
}

export function isEncryptedToken(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `${PREFIX}${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${data.toString("base64")}`;
}

export function decryptToken(stored: string): string {
  if (!isEncryptedToken(stored)) return stored;
  const [ivB64, tagB64, dataB64] = stored.slice(PREFIX.length).split(":");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}
