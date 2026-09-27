"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

const GRAPH_BASE = "https://graph.instagram.com/v23.0";

/** Conta de Instagram da clínica (ou null) — token sempre mascarado pro client. */
export async function getInstagramAccount(clinicId: string) {
  await requireAdminSession();
  const account = await prisma.instagramAccount.findUnique({ where: { clinicId } });
  if (!account) return null;
  return {
    igUserId: account.igUserId,
    username: account.username,
    active: account.active,
    tokenMasked: `••••${account.accessToken.slice(-4)}`,
    updatedAt: account.updatedAt,
  };
}

/** Valida o token na Graph API (GET /me devolve o user_id que chega como entry.id no
 * webhook) e inscreve a conta no webhook de mensagens (POST /me/subscribed_apps) —
 * no Instagram Login essa inscrição é por conta, sem ela nenhuma DM chega. */
export async function saveInstagramAccount(clinicId: string, input: { accessToken: string }) {
  await requireAdminSession();
  const existing = await prisma.instagramAccount.findUnique({ where: { clinicId } });
  const accessToken = input.accessToken.trim() || existing?.accessToken || "";
  if (!accessToken) throw new Error("Cole o token de acesso da conta do Instagram.");

  const meRes = await fetch(`${GRAPH_BASE}/me?fields=user_id,username`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  const me = (await meRes?.json().catch(() => null)) as { user_id?: string | number; username?: string; error?: { message?: string } } | null;
  if (!meRes?.ok || !me?.user_id) {
    throw new Error(`Token recusado pela Meta: ${me?.error?.message ?? "sem resposta"}`);
  }

  const subRes = await fetch(`${GRAPH_BASE}/me/subscribed_apps?subscribed_fields=messages,messaging_seen`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10000),
  }).catch(() => null);
  if (!subRes?.ok) {
    const err = (await subRes?.json().catch(() => null)) as { error?: { message?: string } } | null;
    throw new Error(`Token válido, mas a inscrição no webhook falhou: ${err?.error?.message ?? "sem resposta"}`);
  }

  const igUserId = String(me.user_id);
  const other = await prisma.instagramAccount.findUnique({ where: { igUserId } });
  if (other && other.clinicId !== clinicId) throw new Error("Essa conta do Instagram já está vinculada a outra clínica.");

  await prisma.instagramAccount.upsert({
    where: { clinicId },
    update: { accessToken, igUserId, username: me.username ?? null, active: true },
    create: { clinicId, accessToken, igUserId, username: me.username ?? null },
  });
  revalidatePath("/admin/clinicas");
  return { success: true as const, username: me.username ?? null };
}

export async function toggleInstagramAccountActive(clinicId: string, active: boolean) {
  await requireAdminSession();
  await prisma.instagramAccount.update({ where: { clinicId }, data: { active } });
  revalidatePath("/admin/clinicas");
  return { success: true as const };
}
