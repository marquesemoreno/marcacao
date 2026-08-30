"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Troca a própria senha (clínica ou admin) — exige a senha atual pra confirmar identidade. */
export async function changeMyPassword(currentPassword: string, newPassword: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error("Não autorizado.");
  }
  if (newPassword.length < 6) {
    throw new Error("A nova senha precisa ter pelo menos 6 caracteres.");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { passwordHash: true },
  });
  if (!user) {
    throw new Error("Usuário não encontrado.");
  }

  const bcrypt = (await import("bcryptjs")).default;
  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    throw new Error("Senha atual incorreta.");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: session.user.id }, data: { passwordHash } });

  return { success: true as const };
}
