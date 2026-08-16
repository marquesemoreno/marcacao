"use server";

import { revalidatePath } from "next/cache";
import type { PartnerLeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { submitPartnerLeadSchema, type SubmitPartnerLeadInput } from "@/lib/schemas/partner-lead";

/** Formulário público de "Seja um Parceiro" — sem autenticação, guest-checkout como o agendamento. */
export async function submitPartnerLead(input: SubmitPartnerLeadInput) {
  const data = submitPartnerLeadSchema.parse(input);
  return prisma.partnerLead.create({ data });
}

export async function listPartnerLeads() {
  await requireAdminSession();
  return prisma.partnerLead.findMany({ orderBy: { createdAt: "desc" } });
}

export async function updatePartnerLeadStatus(leadId: string, status: PartnerLeadStatus) {
  await requireAdminSession();
  await prisma.partnerLead.update({ where: { id: leadId }, data: { status } });
  revalidatePath("/admin/leads");
}
