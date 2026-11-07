"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";

/** Saudação ampliada + endereço automático (Etapa 2.3) — página Ações da IA. */
export async function getWelcomeSettings() {
  const { clinicId, userId } = await requireClinicSession();
  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { welcomeMessageEnabled: true, welcomeMessageText: true, addressReplyEnabled: true, address: true, neighborhood: true, city: true },
    }),
    prisma.user.findUnique({ where: { id: userId }, select: { isManager: true } }),
  ]);
  return {
    welcomeEnabled: !!clinic?.welcomeMessageEnabled,
    welcomeText: clinic?.welcomeMessageText?.trim() || "{{saudacao}}, {{nome}}! Em que posso ajudar?",
    addressEnabled: !!clinic?.addressReplyEnabled,
    address: [clinic?.address, clinic?.neighborhood].filter(Boolean).join(" - ") + (clinic?.city ? `, ${clinic.city}` : ""),
    canEdit: !!user?.isManager,
  };
}

export async function setWelcomeSettings(input: { welcomeEnabled: boolean; welcomeText: string; addressEnabled: boolean }) {
  const { clinicId } = await requireClinicManager();
  const text = input.welcomeText.trim().slice(0, 1000);
  if (input.welcomeEnabled && !text) throw new Error("Escreva a mensagem de boas-vindas.");
  await prisma.clinic.update({
    where: { id: clinicId },
    data: { welcomeMessageEnabled: input.welcomeEnabled, welcomeMessageText: text || null, addressReplyEnabled: input.addressEnabled },
  });
  return getWelcomeSettings();
}
