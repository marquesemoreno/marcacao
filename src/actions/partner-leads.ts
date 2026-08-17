"use server";

import { revalidatePath } from "next/cache";
import type { PartnerLeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { submitPartnerLeadSchema, type SubmitPartnerLeadInput } from "@/lib/schemas/partner-lead";
import { createClinicSchema } from "@/lib/schemas/admin";

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

/**
 * Fecha o gap entre captação e ativação: até aqui, marcar um lead como PARTNER
 * não criava a Clinic (ver docs/obsidian/02 e 07) — o admin tinha que abrir
 * /admin/clinicas e preencher tudo de novo à mão. Cria a clínica e marca o
 * lead como PARTNER numa única transação.
 */
export async function approveAndRegisterClinic(leadId: string, formData: FormData) {
  await requireAdminSession();

  const data = createClinicSchema.parse({
    name: formData.get("name"),
    tradeName: formData.get("tradeName"),
    cnpj: formData.get("cnpj"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    address: formData.get("address"),
    neighborhood: formData.get("neighborhood"),
    city: formData.get("city"),
    commissionRate: formData.get("commissionRate"),
  });

  await prisma.$transaction([
    prisma.clinic.create({ data }),
    prisma.partnerLead.update({ where: { id: leadId }, data: { status: "PARTNER" } }),
  ]);

  revalidatePath("/admin/leads");
  revalidatePath("/admin/clinicas");
}
