"use server";

import { revalidatePath } from "next/cache";
import type { MspLeadStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { mspLeadSchema, type MspLeadInput } from "@/lib/schemas/msp-lead";
import { sendMspOutreachNow as sendMspOutreachNowLib, buildMspOutreachDraft } from "@/lib/msp-lead-outreach";
import { formatToWhatsAppNumber } from "@/lib/whatsapp";

/** Além dos leads, resolve o `Contact` correspondente pelo telefone (mesmo formato
 * usado pra gravar Contact.phone, ver formatToWhatsAppNumber) — quando existe, é
 * porque o lead já respondeu e a conversa de verdade está em /admin/inbox (clínica
 * TIVDC). Vira o link "Ver conversa" na UI, sem precisar guardar essa relação. */
export async function listMspLeads() {
  await requireAdminSession();
  const leads = await prisma.mspLead.findMany({ orderBy: { createdAt: "desc" } });
  if (leads.length === 0) return [];

  const contacts = await prisma.contact.findMany({
    where: { phone: { in: leads.map((lead) => formatToWhatsAppNumber(lead.phone)) } },
    select: { id: true, phone: true },
  });
  const contactIdByPhone = new Map(contacts.map((c) => [c.phone, c.id]));

  return leads.map((lead) => ({
    ...lead,
    contactId: contactIdByPhone.get(formatToWhatsAppNumber(lead.phone)) ?? null,
  }));
}

/** Estado do disparo automático (ver src/lib/msp-lead-outreach.ts) — cria a linha
 * singleton na primeira leitura, sempre desligada por padrão. */
export async function getMspOutreachStatus() {
  await requireAdminSession();
  const state = await prisma.mspOutreachState.upsert({
    where: { id: "singleton" },
    update: {},
    create: { id: "singleton" },
  });
  const pendingCount = await prisma.mspLead.count({ where: { status: "NEW" } });
  return { enabled: state.enabled, nextRunAt: state.nextRunAt, pendingCount };
}

/** Liga/desliga o disparo automático — nunca começa sozinho. Ao ligar, zera
 * nextRunAt pra "agora" (primeira mensagem sai já no próximo tick do cron). */
export async function setMspOutreachEnabled(enabled: boolean) {
  await requireAdminSession();
  await prisma.mspOutreachState.upsert({
    where: { id: "singleton" },
    update: { enabled, ...(enabled ? { nextRunAt: new Date() } : {}) },
    create: { id: "singleton", enabled },
  });
  revalidatePath("/admin/leads-msp");
}

export async function createMspLeadManually(input: MspLeadInput) {
  await requireAdminSession();
  const data = mspLeadSchema.parse(input);
  await prisma.mspLead.create({ data });
  revalidatePath("/admin/leads-msp");
}

/** Importação em lote via CSV (ver ImportMspLeadsCsvDialog) — o cliente só faz o
 * parse (parseMspLeadCsv), a validação de verdade acontece aqui, linha a linha,
 * pra não travar o lote inteiro por causa de uma linha ruim. */
export async function createMspLeadsFromCsv(rows: MspLeadInput[]) {
  await requireAdminSession();

  let created = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const parsed = mspLeadSchema.safeParse(row);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "dados inválidos";
      errors.push(`Linha ${index + 2}: ${message}`);
      continue;
    }
    await prisma.mspLead.create({ data: parsed.data });
    created++;
  }

  revalidatePath("/admin/leads-msp");
  return { created, errors };
}

export async function updateMspLeadStatus(leadId: string, status: MspLeadStatus) {
  await requireAdminSession();
  await prisma.mspLead.update({ where: { id: leadId }, data: { status } });
  revalidatePath("/admin/leads-msp");
}

/** Monta o texto pro admin revisar antes de mandar (ver botão "Enviar agora" em
 * admin/leads-msp) — sem IA, é o template fixo com o nome já substituído. */
export async function getMspOutreachDraft(leadId: string) {
  await requireAdminSession();
  const lead = await prisma.mspLead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false as const, reason: "lead_not_found" as const };
  return { success: true as const, message: buildMspOutreachDraft(lead) };
}

/** Envia o texto já revisado (e possivelmente editado) pelo admin — independente
 * do interruptor automático estar ligado. */
export async function sendMspOutreachNow(leadId: string, message: string) {
  await requireAdminSession();
  const result = await sendMspOutreachNowLib(leadId, message);
  revalidatePath("/admin/leads-msp");
  return result;
}
