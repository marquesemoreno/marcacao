"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireClinicManager } from "@/lib/session";

/** Liga/desliga a conta do Instagram da própria clínica no Chat (gestão). Desligar não apaga o
 * token: as mensagens param de entrar e sair até religar ou conectar de novo. */
export async function setClinicInstagramActive(active: boolean) {
  const { clinicId } = await requireClinicManager();
  const account = await prisma.instagramAccount.findUnique({ where: { clinicId }, select: { id: true } });
  if (!account) throw new Error("A clínica ainda não conectou um Instagram.");
  await prisma.instagramAccount.update({ where: { clinicId }, data: { active } });
  revalidatePath("/clinic/instagram");
  return { success: true as const };
}
