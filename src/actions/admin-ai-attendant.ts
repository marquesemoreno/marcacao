"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

export async function getAiAttendantConfig(clinicId: string) {
  await requireAdminSession();
  const config = await prisma.aiAttendantConfig.findUnique({ where: { clinicId } });
  if (!config) return null;
  return { active: config.active, instructions: config.instructions, assistantName: config.assistantName };
}

/** Salva/atualiza a config do atendente de IA dessa clínica. As regras fixas de
 * consentimento/transparência/escalação (LGPD) não são editáveis por aqui — ver
 * src/lib/ai-attendant.ts. `assistantName` é só o nome usado na apresentação (ex:
 * "Lara", "TI") — sem ele, o aviso de consentimento cai no texto genérico. */
export async function saveAiAttendantConfig(
  clinicId: string,
  input: { active: boolean; instructions: string; assistantName?: string }
) {
  await requireAdminSession();

  const instructions = input.instructions.trim();
  if (input.active && !instructions) {
    throw new Error("Escreva as instruções da clínica antes de ativar o atendente de IA.");
  }
  const assistantName = input.assistantName?.trim() || null;

  await prisma.aiAttendantConfig.upsert({
    where: { clinicId },
    update: { active: input.active, instructions, assistantName },
    create: { clinicId, active: input.active, instructions, assistantName },
  });

  revalidatePath("/admin/clinicas");
  return { success: true as const };
}
