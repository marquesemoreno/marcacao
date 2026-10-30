const DAY = 86_400_000;
/** Renova com folga: o token de longa duração do Instagram vale 60 dias. */
const REFRESH_WHEN_DAYS_LEFT = 15;

/** A Meta só renova tokens com pelo menos 24h; sem validade conhecida (token colado no
 * Admin) renova assim que puder, e a resposta passa a dizer quando vence. */
export function shouldRefreshInstagramToken(
  account: { tokenExpiresAt: Date | null; updatedAt: Date },
  now = new Date(),
): boolean {
  if (now.getTime() - account.updatedAt.getTime() < DAY) return false;
  if (!account.tokenExpiresAt) return true;
  return account.tokenExpiresAt.getTime() - now.getTime() <= REFRESH_WHEN_DAYS_LEFT * DAY;
}

/** GET /refresh_access_token — devolve um token novo de 60 dias (o antigo segue válido até vencer). */
export async function refreshInstagramToken(accessToken: string) {
  const url = `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(accessToken)}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  const body = (await res?.json().catch(() => null)) as
    | { access_token?: string; expires_in?: number; error?: { message?: string } }
    | null;
  if (!res?.ok || !body?.access_token || !body.expires_in) {
    return { ok: false as const, error: body?.error?.message ?? `HTTP ${res?.status ?? "sem resposta"}` };
  }
  return { ok: true as const, accessToken: body.access_token, expiresAt: new Date(Date.now() + body.expires_in * 1000) };
}
