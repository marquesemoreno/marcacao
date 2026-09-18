import "server-only";
import { prisma } from "@/lib/prisma";
import { sendWhatsAppMessage, formatToWhatsAppNumber } from "@/lib/whatsapp";
import { getTivdcClinicId } from "@/lib/tivdc";
import { BROADCAST_OPT_OUT_FOOTER } from "@/lib/broadcast-csv";
import { buildMspOutreachMessage, isWithinOutreachWindow } from "@/lib/msp-lead-message";
import type { MspLead } from "@prisma/client";

const OUTREACH_STATE_ID = "singleton";

/** Usado pelo webhook (route.ts) pra não deixar o atendente de IA de suporte da TIVDC
 * (que abre chamado no GLPI) confundir a resposta de um lead comercial com um chamado
 * técnico: quando o telefone que respondeu é um MspLead conhecido, o webhook pula o
 * fluxo de consentimento/resposta de IA inteiro e marca a conversa como comercial. A
 * tabela é pequena (dezenas de linhas), então comparar em memória é mais simples que
 * tentar expressar a normalização de telefone (formatToWhatsAppNumber) num where do
 * Prisma. */
export async function isKnownMspLeadPhone(contactPhone: string): Promise<boolean> {
  const leads = await prisma.mspLead.findMany({ select: { phone: true } });
  return leads.some((lead) => formatToWhatsAppNumber(lead.phone) === contactPhone);
}

/** Próximo intervalo até o disparo seguinte — mesmo espírito de nextJitteredDelayMs
 * em ai-lead-outreach.ts: "por volta de 5 minutos", nunca cravado. */
function nextJitteredDelayMs(): number {
  const minutes = 4 + Math.random() * 2; // 4–6 min
  return Math.round(minutes * 60 * 1000);
}

export type MspOutreachTickResult =
  | { sent: false; reason: "disabled" | "not_due" | "outside_window" | "no_leads" | "clinic_not_found" | "send_failed" }
  | { sent: true; leadId: string };

/** Chamado a cada 5min pelo GitHub Actions (ver lead-outreach-dispatch.yml e
 * /api/cron/msp-lead-outreach). Manda no MÁXIMO 1 mensagem por chamada — o
 * espaçamento de verdade vem do `nextRunAt`, não da frequência do cron em si. */
export async function runMspOutreachTick(): Promise<MspOutreachTickResult> {
  const state = await prisma.mspOutreachState.upsert({
    where: { id: OUTREACH_STATE_ID },
    update: {},
    create: { id: OUTREACH_STATE_ID },
  });

  if (!state.enabled) return { sent: false, reason: "disabled" };
  if (state.nextRunAt.getTime() > Date.now()) return { sent: false, reason: "not_due" };

  if (!isWithinOutreachWindow(new Date())) {
    // Fora do horário permitido pelo playbook (evita 8h-9h e 12h-14h) — só reagenda
    // pro próximo tick, sem consumir um lead da fila.
    await prisma.mspOutreachState.update({
      where: { id: OUTREACH_STATE_ID },
      data: { nextRunAt: new Date(Date.now() + nextJitteredDelayMs()) },
    });
    return { sent: false, reason: "outside_window" };
  }

  const lead = await prisma.mspLead.findFirst({
    where: { status: "NEW" },
    orderBy: { createdAt: "asc" },
  });
  if (!lead) return { sent: false, reason: "no_leads" };

  const clinicId = await getTivdcClinicId();
  if (!clinicId) return { sent: false, reason: "clinic_not_found" };

  const message = `${buildMspOutreachMessage(lead)}\n\n${BROADCAST_OPT_OUT_FOOTER}`;
  const result = await sendWhatsAppMessage(lead.phone, message, "msp_outreach.sent", clinicId);
  if (!result.success) return { sent: false, reason: "send_failed" };

  await prisma.$transaction([
    prisma.mspLead.update({ where: { id: lead.id }, data: { status: "CONTACTED" } }),
    prisma.mspOutreachState.update({
      where: { id: OUTREACH_STATE_ID },
      data: { nextRunAt: new Date(Date.now() + nextJitteredDelayMs()) },
    }),
  ]);

  return { sent: true, leadId: lead.id };
}

export type SendMspOutreachNowResult =
  | { success: true }
  | { success: false; reason: "lead_not_found" | "clinic_not_found" | "send_failed" };

/** Disparo manual, fora do ciclo automático (botão "Enviar agora" em admin/leads-msp) —
 * recebe o texto já revisado (e possivelmente editado) pelo admin. */
export async function sendMspOutreachNow(leadId: string, message: string): Promise<SendMspOutreachNowResult> {
  const lead = await prisma.mspLead.findUnique({ where: { id: leadId } });
  if (!lead) return { success: false, reason: "lead_not_found" };

  const clinicId = await getTivdcClinicId();
  if (!clinicId) return { success: false, reason: "clinic_not_found" };

  const result = await sendWhatsAppMessage(lead.phone, message, "msp_outreach.sent", clinicId);
  if (!result.success) return { success: false, reason: "send_failed" };

  await prisma.mspLead.update({
    where: { id: lead.id },
    data: { status: lead.status === "NEW" ? "CONTACTED" : lead.status },
  });

  return { success: true };
}

/** Só monta o texto pro admin revisar antes de mandar (ver botão "Enviar agora" em
 * admin/leads-msp) — não envia nada. Ao contrário do outreach de parceiros, não
 * precisa de IA nem pode falhar por "IA indisponível": é substituição de template. */
export function buildMspOutreachDraft(lead: MspLead): string {
  return `${buildMspOutreachMessage(lead)}\n\n${BROADCAST_OPT_OUT_FOOTER}`;
}
