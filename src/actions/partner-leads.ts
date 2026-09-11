"use server";

import { revalidatePath } from "next/cache";
import type { PartnerLeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { submitPartnerLeadSchema, type SubmitPartnerLeadInput } from "@/lib/schemas/partner-lead";
import { createClinicSchema } from "@/lib/schemas/admin";
import { sendOutreachMessageNow } from "@/lib/ai-lead-outreach";

/** Formulário público de "Seja um Parceiro" — sem autenticação, guest-checkout como o agendamento. */
export async function submitPartnerLead(input: SubmitPartnerLeadInput) {
  const data = submitPartnerLeadSchema.parse(input);
  return prisma.partnerLead.create({ data });
}

export async function listPartnerLeads() {
  await requireAdminSession();
  return prisma.partnerLead.findMany({ orderBy: { createdAt: "desc" } });
}

/** Estado do contato automático via IA (ver src/lib/ai-lead-outreach.ts) — cria
 * a linha singleton na primeira leitura, sempre desligada por padrão. */
export async function getOutreachStatus() {
  await requireAdminSession();
  const state = await prisma.aiOutreachState.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const pendingCount = await prisma.partnerLead.count({ where: { status: "NEW" } });
  return { enabled: state.enabled, nextRunAt: state.nextRunAt, pendingCount };
}

/** Liga/desliga o disparo automático — nunca começa sozinho, só quando o admin
 * decide aqui. Ao ligar, zera nextRunAt pra "agora" (primeira mensagem sai já
 * no próximo tick do cron, não espera o intervalo de 4-6min de um envio que
 * nunca aconteceu). */
export async function setOutreachEnabled(enabled: boolean) {
  await requireAdminSession();
  await prisma.aiOutreachState.upsert({
    where: { id: "singleton" },
    update: { enabled, ...(enabled ? { nextRunAt: new Date() } : {}) },
    create: { id: "singleton", enabled },
  });
  revalidatePath("/admin/leads");
}

/** Cadastro manual pelo admin (ver AddLeadDialog em admin/leads) — mesmo schema do
 * formulário público de /seja-parceiro, só que autenticado, pra leads que o admin
 * já tem de fontes externas e quer colocar na fila de contato via IA. */
export async function createPartnerLeadManually(input: SubmitPartnerLeadInput) {
  await requireAdminSession();
  const data = submitPartnerLeadSchema.parse(input);
  await prisma.partnerLead.create({ data });
  revalidatePath("/admin/leads");
}

/** Disparo manual pra um lead específico (ver botão "Enviar agora" em admin/leads),
 * independente do interruptor automático estar ligado. */
export async function sendOutreachNow(leadId: string) {
  await requireAdminSession();
  await sendOutreachMessageNow(leadId);
  revalidatePath("/admin/leads");
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
