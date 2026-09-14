"use server";

import { revalidatePath } from "next/cache";
import type { ClinicKnowledgeCategory } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";

export async function listClinicKnowledge(clinicId: string) {
  await requireAdminSession();
  return prisma.clinicKnowledgeEntry.findMany({
    where: { clinicId },
    orderBy: [{ category: "asc" }, { title: "asc" }],
  });
}

export async function createClinicKnowledgeEntry(
  clinicId: string,
  input: { category: ClinicKnowledgeCategory; title: string; content: string }
) {
  await requireAdminSession();

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    throw new Error("Preencha o título e o conteúdo.");
  }

  await prisma.clinicKnowledgeEntry.create({
    data: { clinicId, category: input.category, title, content },
  });
  revalidatePath("/admin/clinicas");
}

export async function updateClinicKnowledgeEntry(
  id: string,
  input: { category: ClinicKnowledgeCategory; title: string; content: string; active: boolean }
) {
  await requireAdminSession();

  const title = input.title.trim();
  const content = input.content.trim();
  if (!title || !content) {
    throw new Error("Preencha o título e o conteúdo.");
  }

  await prisma.clinicKnowledgeEntry.update({
    where: { id },
    data: { category: input.category, title, content, active: input.active },
  });
  revalidatePath("/admin/clinicas");
}

export async function toggleClinicKnowledgeEntry(id: string, active: boolean) {
  await requireAdminSession();
  await prisma.clinicKnowledgeEntry.update({ where: { id }, data: { active } });
  revalidatePath("/admin/clinicas");
}

export async function deleteClinicKnowledgeEntry(id: string) {
  await requireAdminSession();
  await prisma.clinicKnowledgeEntry.delete({ where: { id } });
  revalidatePath("/admin/clinicas");
}
