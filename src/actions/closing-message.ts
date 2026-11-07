"use server";

import { prisma } from "@/lib/prisma";
import { requireClinicManager, requireClinicSession } from "@/lib/session";
import { DEFAULT_CLOSING_MESSAGE } from "@/lib/closing-message";

/** Despedida ao finalizar (Etapa 2.2): lida pelo modal de finalizar e pela página IA. */
export async function getClosingMessageSetting() {
  const { clinicId, userId } = await requireClinicSession();
  const [clinic, user] = await Promise.all([
    prisma.clinic.findUnique({ where: { id: clinicId }, select: { closingMessageEnabled: true, closingMessageText: true } }),
    prisma.user.findUnique({ where: { id: userId }, select: { isManager: true } }),
  ]);
  return {
    enabled: !!clinic?.closingMessageEnabled,
    text: clinic?.closingMessageText?.trim() || DEFAULT_CLOSING_MESSAGE,
    canEdit: !!user?.isManager,
  };
}

export async function setClosingMessageSetting(input: { enabled: boolean; text: string }) {
  const { clinicId } = await requireClinicManager();
  const text = input.text.trim().slice(0, 1000);
  if (input.enabled && !text) throw new Error("Escreva a mensagem de despedida.");
  await prisma.clinic.update({
    where: { id: clinicId },
    data: { closingMessageEnabled: input.enabled, closingMessageText: text && text !== DEFAULT_CLOSING_MESSAGE ? text : null },
  });
  return getClosingMessageSetting();
}
