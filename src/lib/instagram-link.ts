import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";
import { getBaseUrl } from "@/lib/format";
import { parseShortTokenResponse } from "@/lib/instagram-oauth";

const GRAPH_BASE = "https://graph.instagram.com/v23.0";

/** Endereço de volta do login do Instagram — tem que ser idêntico ao cadastrado no painel da Meta
 * (Instagram › API com login do Instagram › Configurar login comercial). */
export function instagramRedirectUri(): string {
  return process.env.INSTAGRAM_REDIRECT_URI || `${getBaseUrl()}/api/instagram/callback`;
}

/** Troca o código do login pelo token de longa duração (60 dias; o cron renova). */
export async function exchangeInstagramCode(code: string): Promise<{ accessToken: string; expiresAt: Date | null; permissions: string[] }> {
  const appId = process.env.INSTAGRAM_APP_ID;
  const secret = process.env.INSTAGRAM_APP_SECRET;
  if (!appId || !secret) throw new Error("Login do Instagram não configurado (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET).");

  const form = new URLSearchParams({ client_id: appId, client_secret: secret, grant_type: "authorization_code", redirect_uri: instagramRedirectUri(), code });
  const shortRes = await fetch("https://api.instagram.com/oauth/access_token", { method: "POST", body: form, signal: AbortSignal.timeout(10000) }).catch(() => null);
  const shortJson = (await shortRes?.json().catch(() => null)) as { error_message?: string } | null;
  const short = parseShortTokenResponse(shortJson);
  if (!shortRes?.ok || !short) throw new Error(`O Instagram recusou a autorização: ${shortJson?.error_message ?? "sem resposta"}`);

  const longUrl = `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${encodeURIComponent(secret)}&access_token=${encodeURIComponent(short.accessToken)}`;
  const longRes = await fetch(longUrl, { signal: AbortSignal.timeout(10000) }).catch(() => null);
  const long = (await longRes?.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: { message?: string } } | null;
  if (!longRes?.ok || !long?.access_token) throw new Error(`Não foi possível gerar o token de longa duração: ${long?.error?.message ?? "sem resposta"}`);

  return {
    accessToken: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
    permissions: short.permissions,
  };
}

/** Valida o token (GET /me devolve o user_id que chega como entry.id no webhook), inscreve a
 * conta no webhook de mensagens (no Instagram Login a inscrição é por conta — sem ela nenhuma DM
 * chega) e grava a conta da clínica com o token cifrado. Usado pelo botão "Conectar Instagram" e
 * pelo cadastro manual do Admin. */
export async function linkInstagramAccount(clinicId: string, accessToken: string, expiresAt: Date | null): Promise<{ username: string | null; igUserId: string }> {
  const meRes = await fetch(`${GRAPH_BASE}/me?fields=user_id,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  const me = (await meRes?.json().catch(() => null)) as { user_id?: string | number; username?: string; error?: { message?: string } } | null;
  if (!meRes?.ok || !me?.user_id) throw new Error(`Token recusado pela Meta: ${me?.error?.message ?? "sem resposta"}`);

  const subRes = await fetch(`${GRAPH_BASE}/me/subscribed_apps?subscribed_fields=messages,messaging_seen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!subRes?.ok) {
    const err = (await subRes?.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Conta autorizada, mas a inscrição no webhook falhou: ${err?.error?.message ?? "sem resposta"}`);
  }

  const igUserId = String(me.user_id);
  const other = await prisma.instagramAccount.findUnique({ where: { igUserId } });
  if (other && other.clinicId !== clinicId) throw new Error("Essa conta do Instagram já está vinculada a outra clínica.");

  const existing = await prisma.instagramAccount.findUnique({ where: { clinicId } });
  const sameToken = existing ? decryptToken(existing.accessToken) === accessToken : false;
  const username = me.username ?? null;
  await prisma.instagramAccount.upsert({
    where: { clinicId },
    // Token cifrado em repouso (auditoria 16/11/2026, M6).
    update: { accessToken: encryptToken(accessToken), igUserId, username, active: true, ...(sameToken ? {} : { tokenExpiresAt: expiresAt }) },
    create: { clinicId, accessToken: encryptToken(accessToken), igUserId, username, tokenExpiresAt: expiresAt },
  });
  return { username, igUserId };
}
