"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/token-crypto";
import { requireAdminSession } from "@/lib/session";
import { linkInstagramAccount } from "@/lib/instagram-link";

/** Conta de Instagram da clínica (ou null) — token sempre mascarado pro client. */
export async function getInstagramAccount(clinicId: string) {
  await requireAdminSession();
  const account = await prisma.instagramAccount.findUnique({ where: { clinicId } });
  if (!account) return null;
  return {
    igUserId: account.igUserId,
    username: account.username,
    active: account.active,
    tokenMasked: `••••${decryptToken(account.accessToken).slice(-4)}`,
    updatedAt: account.updatedAt,
  };
}

/** Valida o token na Graph API (GET /me devolve o user_id que chega como entry.id no
 * webhook) e inscreve a conta no webhook de mensagens (POST /me/subscribed_apps) —
 * no Instagram Login essa inscrição é por conta, sem ela nenhuma DM chega. */
export async function saveInstagramAccount(clinicId: string, input: { accessToken: string }) {
  await requireAdminSession();
  const existing = await prisma.instagramAccount.findUnique({ where: { clinicId } });
  const previous = existing ? decryptToken(existing.accessToken) : "";
  const accessToken = input.accessToken.trim() || previous;
  if (!accessToken) throw new Error("Cole o token de acesso da conta do Instagram.");

  // Token colado: validade desconhecida até o cron de renovação rodar.
  const { username } = await linkInstagramAccount(clinicId, accessToken, null);
  revalidatePath("/admin/clinicas");
  return { success: true as const, username };
}

export async function toggleInstagramAccountActive(clinicId: string, active: boolean) {
  await requireAdminSession();
  await prisma.instagramAccount.update({ where: { clinicId }, data: { active } });
  revalidatePath("/admin/clinicas");
  return { success: true as const };
}
