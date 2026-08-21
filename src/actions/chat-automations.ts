"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { chatAutomationSchema, type ChatAutomationInput } from "@/lib/schemas/chat-automation";

export async function listChatAutomations() {
  await requireAdminSession();
  return prisma.chatAutomation.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createChatAutomation(input: ChatAutomationInput) {
  await requireAdminSession();
  const data = chatAutomationSchema.parse(input);
  const automation = await prisma.chatAutomation.create({ data });
  revalidatePath("/admin/automacoes");
  return automation;
}

export async function updateChatAutomation(id: string, input: ChatAutomationInput) {
  await requireAdminSession();
  const data = chatAutomationSchema.parse(input);
  const automation = await prisma.chatAutomation.update({ where: { id }, data });
  revalidatePath("/admin/automacoes");
  return automation;
}

export async function toggleChatAutomationActive(id: string, active: boolean) {
  await requireAdminSession();
  await prisma.chatAutomation.update({ where: { id }, data: { active } });
  revalidatePath("/admin/automacoes");
}

export async function deleteChatAutomation(id: string) {
  await requireAdminSession();
  await prisma.chatAutomation.delete({ where: { id } });
  revalidatePath("/admin/automacoes");
}
