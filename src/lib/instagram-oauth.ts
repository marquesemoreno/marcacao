/** Login comercial do Instagram (Instagram API com login do Instagram) — botão "Conectar
 * Instagram" em /clinic/instagram (19/11/2026). Puro: URL de autorização, `state` assinado
 * (HMAC, vale 15 min) e leitura da resposta da troca do código. A parte com rede/banco fica em
 * instagram-link.ts. */
import { createHmac, timingSafeEqual } from "crypto";

export const INSTAGRAM_SCOPES = ["instagram_business_basic", "instagram_business_manage_messages"] as const;
export const OAUTH_STATE_MAX_AGE_MS = 15 * 60_000;
export const OAUTH_NONCE_COOKIE = "ig_oauth_nonce";

export type OAuthStatePayload = { clinicId: string; userId: string; nonce: string; issuedAt: number };

export function buildInstagramAuthorizeUrl(o: { appId: string; redirectUri: string; state: string }): string {
  const url = new URL("https://www.instagram.com/oauth/authorize");
  url.searchParams.set("client_id", o.appId);
  url.searchParams.set("redirect_uri", o.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", INSTAGRAM_SCOPES.join(","));
  url.searchParams.set("state", o.state);
  return url.toString();
}

const sign = (body: string, secret: string) => createHmac("sha256", secret).update(body).digest("base64url");

export function signOAuthState(payload: OAuthStatePayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function verifyOAuthState(state: string | null | undefined, secret: string, now = Date.now()): OAuthStatePayload | null {
  if (!state) return null;
  const [body, sig, extra] = state.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<OAuthStatePayload>;
    if (typeof p.clinicId !== "string" || typeof p.userId !== "string" || typeof p.nonce !== "string" || typeof p.issuedAt !== "number") return null;
    if (now - p.issuedAt > OAUTH_STATE_MAX_AGE_MS || p.issuedAt - now > 60_000) return null;
    return { clinicId: p.clinicId, userId: p.userId, nonce: p.nonce, issuedAt: p.issuedAt };
  } catch {
    return null;
  }
}

/** O Instagram devolve o código com "#_" no fim (vem do fragmento da URL). */
export function cleanAuthCode(code: string | null | undefined): string {
  return (code ?? "").replace(/#_$/, "").trim();
}

type ShortTokenRow = { access_token?: string; user_id?: string | number; permissions?: string | string[] };

/** POST api.instagram.com/oauth/access_token — formato atual (objeto) ou antigo ({ data: [..] }). */
export function parseShortTokenResponse(json: unknown): { accessToken: string; userId: string; permissions: string[] } | null {
  if (!json || typeof json !== "object") return null;
  const row = (Array.isArray((json as { data?: unknown }).data) ? (json as { data: ShortTokenRow[] }).data[0] : json) as ShortTokenRow | undefined;
  if (!row?.access_token || row.user_id === undefined) return null;
  const permissions = Array.isArray(row.permissions) ? row.permissions : (row.permissions ?? "").split(",").filter(Boolean);
  return { accessToken: row.access_token, userId: String(row.user_id), permissions: permissions.map((p) => p.trim()) };
}
